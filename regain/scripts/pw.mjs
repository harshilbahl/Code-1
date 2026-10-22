// Resolve Playwright from the project, or from a global install (no network needed).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

export function loadPlaywright() {
  const req = createRequire(import.meta.url);
  try {
    return req('playwright');
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return req(`${globalRoot}/playwright`);
  }
}
