// Renders public/icons/icon.svg into the PNG sizes iOS/Android need. Run: npm run icons
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadPlaywright } from './pw.mjs';

const dir = fileURLToPath(new URL('../public/icons/', import.meta.url));
const svg = readFileSync(dir + 'icon.svg', 'utf8');
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage();

const targets = [
  { file: 'apple-touch-icon.png', size: 180, pad: 0, bleed: true },
  { file: 'icon-192.png', size: 192, pad: 0, bleed: false },
  { file: 'icon-512.png', size: 512, pad: 0, bleed: false },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.12, bleed: true },
];
for (const t of targets) {
  // iOS applies its own rounded mask, so apple/maskable icons are full-bleed squares.
  const inner = t.bleed ? svg.replace('rx="112"', 'rx="0"') : svg;
  const padPx = Math.round(t.size * t.pad);
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:${t.bleed ? '#0a0a0b' : 'transparent'}"><div style="padding:${padPx}px;width:${t.size}px;height:${t.size}px;box-sizing:border-box">${inner.replace('<svg ', `<svg width="${t.size - 2 * padPx}" height="${t.size - 2 * padPx}" `)}</div></body></html>`,
  );
  await page.screenshot({ path: dir + t.file, omitBackground: !t.bleed });
  console.log('wrote', t.file);
}
await browser.close();
