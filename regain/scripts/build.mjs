// Build: type-check + compile TS to native ES modules, copy static files, generate the
// service worker with a content-hashed version and the full precache list. No bundler needed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const watch = process.argv.includes('--no-clean');

if (!watch && existsSync(dist)) rmSync(dist, { recursive: true, force: true });
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(root, 'tsconfig.json')], { stdio: 'inherit' });
cpSync(join(root, 'public'), dist, { recursive: true, filter: (src) => !src.endsWith('sw.template.js') });

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const files = walk(dist)
  .map((p) => relative(dist, p).split('\\').join('/'))
  .filter((f) => f !== 'sw.js' && !f.endsWith('.map'))
  .sort();

const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 10);

const index = join(dist, 'index.html');
writeFileSync(index, readFileSync(index, 'utf8').replaceAll('__VERSION__', version));

// _headers is hosting config (Netlify/Cloudflare Pages); such hosts do not serve it, and cache.addAll
// is all-or-nothing — precaching it there would fail the whole SW install and disable offline mode.
const assets = ['./', ...files.filter((f) => f !== '_headers').map((f) => './' + f)];
const sw = readFileSync(join(root, 'public/sw.template.js'), 'utf8')
  .replace('__VERSION__', version)
  .replace('__ASSETS__', JSON.stringify(assets, null, 2));
writeFileSync(join(dist, 'sw.js'), sw);

console.log(`Built ReGain ${version}: ${files.length} files → dist/`);
