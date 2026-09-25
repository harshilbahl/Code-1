// Dev loop: build once, then rebuild on changes and serve dist/. Reload the page to see changes.
import { execFileSync, spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const build = () => {
  try {
    execFileSync(process.execPath, ['scripts/build.mjs', '--no-clean'], { cwd: root, stdio: 'inherit' });
  } catch {
    console.error('Build failed — fix errors and save again.');
  }
};
build();
let t;
for (const dir of ['src', 'public']) {
  watch(`${root}/${dir}`, { recursive: true }, () => {
    clearTimeout(t);
    t = setTimeout(build, 150);
  });
}
spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, stdio: 'inherit' });
