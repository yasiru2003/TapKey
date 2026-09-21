import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const factor2Root = process.env.FACTOR2_ROOT;
if (!factor2Root) throw new Error('Set FACTOR2_ROOT to the clean Thashira factor2-spacebar directory');
const requireFromFactor2 = createRequire(path.join(factor2Root, 'package.json'));
const { build } = requireFromFactor2('esbuild');
const here = path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [path.join(factor2Root, 'src/client/captureTapPattern.ts')],
  outfile: path.join(here, '.build/factor2-capture.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
});
console.log('Built Factor 2 browser connector from unchanged Thashira source');
