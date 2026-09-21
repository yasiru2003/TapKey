import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';

test('browser runs the accessibility sequence', async (t) => {
  const server = createServer(async (request, response) => {
    const files = { '/': 'tests/browser-flow.html', '/src/index.js': 'src/index.js', '/src/liveRegion.js': 'src/liveRegion.js', '/src/earconPlayer.js': 'src/earconPlayer.js', '/src/keyHandler.js': 'src/keyHandler.js', '/src/liveRegion.css': 'src/liveRegion.css' };
    const file = files[request.url];
    if (!file) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    response.end(await readFile(path.join(base, file)));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const child = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--virtual-time-budget=3000', '--dump-dom', `http://127.0.0.1:${server.address().port}/`]);
  let output = ''; let errors = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { errors += chunk; });
  const timer = setTimeout(() => child.kill(), 10000);
  const code = await new Promise((resolve) => child.on('close', resolve));
  clearTimeout(timer);
  assert.equal(code, 0, errors);
  assert.match(output, /id="result">PASS:/);
  assert.doesNotMatch(output, /id="result">FAIL:/);
});
