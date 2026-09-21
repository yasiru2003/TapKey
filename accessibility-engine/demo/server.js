import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = new Map([
  ['/', ['demo/index.html', 'text/html; charset=utf-8']],
  ['/src/index.js', ['src/index.js', 'text/javascript; charset=utf-8']],
  ['/src/liveRegion.js', ['src/liveRegion.js', 'text/javascript; charset=utf-8']],
  ['/src/earconPlayer.js', ['src/earconPlayer.js', 'text/javascript; charset=utf-8']],
  ['/src/keyHandler.js', ['src/keyHandler.js', 'text/javascript; charset=utf-8']],
  ['/src/liveRegion.css', ['src/liveRegion.css', 'text/css; charset=utf-8']],
]);
const port = Number(process.env.PORT || 4173);
createServer(async (request, response) => {
  const entry = files.get(new URL(request.url, 'http://localhost').pathname);
  if (!entry) { response.writeHead(404).end('Not found'); return; }
  try {
    const content = await readFile(path.join(root, entry[0]));
    response.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store' }).end(content);
  } catch {
    response.writeHead(500).end('Unable to load demo');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Accessibility demo: http://127.0.0.1:${port}/`);
});
