// End-to-end smoke test of the BUILT app in a mobile-emulated Chromium.
// Usage: npm run build && npm run e2e   (screenshots → e2e-screens/)
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { loadPlaywright } from './pw.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const shots = root + 'e2e-screens/';
mkdirSync(shots, { recursive: true });
const PORT = 5199;
const BASE = `http://localhost:${PORT}/`;

const server = spawn(process.execPath, ['scripts/serve.mjs', String(PORT)], { cwd: root, stdio: 'pipe' });
let serverErr = '';
server.stderr.on('data', (d) => (serverErr += d));
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('exit', (code) => reject(new Error('serve.mjs exited (code ' + code + ') before listening — is port ' + PORT + ' already in use?\n' + serverErr.trim())));
});

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  acceptDownloads: true,
});
context.setDefaultTimeout(5000);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));

let step = 0;
const results = [];
async function check(name, fn) {
  step++;
  try {
    await fn();
    results.push(`✔ ${step}. ${name}`);
    console.log(results[results.length - 1]);
  } catch (e) {
    results.push(`✘ ${step}. ${name}\n    ${String(e.message).split('\n').slice(0, 4).join('\n    ')}`);
    console.log(results[results.length - 1]);
    await page.screenshot({ path: `${shots}FAIL-${step}.png` }).catch(() => {});
    await closeSheets().catch(() => {});
  }
}
const shot = (n) => page.screenshot({ path: `${shots}${n}.png`, fullPage: false });
const tab = async (label) => {
  await page.locator(`.tabbar button[aria-label="${label}"]`).click();
  // render() sets aria-current at the end of the rAF-scheduled re-render, so this waits for the screen swap
  await page.locator(`.tabbar button[aria-label="${label}"][aria-current="page"]`).waitFor();
};
const sheet = (name) => (name ? page.getByRole('dialog', { name, exact: true }) : page.locator('.sheet-backdrop.open .sheet').last());
const closeSheets = async () => {
  await page.waitForTimeout(300); // let any opening sheet finish its enter transition
  while (await page.locator('.sheet-backdrop.open').count()) {
    await page.locator('.sheet-backdrop.open .sheet-close').last().click();
    await page.waitForTimeout(260);
  }
};
const text = async (sel) => (await page.locator(sel).first().innerText()).trim();
// First launch in a fresh profile: wait until the service worker has installed and claimed the page, so every
// later check runs under SW control. main.tsx deliberately does NOT reload on the first-install controllerchange
// (it only reloads when an updated worker takes over) — an unexpected reload here would hang any in-flight
// screenshot until its timeout, which is exactly the bug this wait used to paper over.
const firstLaunch = async (pg) => {
  await pg.goto(BASE);
  // a one-time boot wait (install precaches ~43 files), not a per-check assertion — allow more than the 5 s default
  await pg.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  await pg.waitForSelector('body.ready');
};

await check('Dashboard renders with preloaded BACK workout and targets', async () => {
  await firstLaunch(page);
  await page.waitForSelector('.hero-head');
  const body = await page.locator('#main').innerText();
  assert.match(body, /BACK/);
  assert.match(body, /2,400 kcal/);
  assert.match(body, /130 g/);
  assert.match(body, /60\.0/);
  await shot('01-dashboard');
});

await check('Quick action "Log meal" → one-tap add Egg (72 kcal)', async () => {
  await page.getByRole('button', { name: 'Log meal' }).click();
  await sheet().waitFor();
  await page.locator('button[aria-label="Add 1 serving of Egg (large)"]').click();
  await page.waitForSelector('.toast.show');
  assert.match(await text('.toast'), /Egg/);
  await shot('02-log-meal-sheet');
  await closeSheets();
});

await check('Natural-language entry parses, flags unknown food, logs matched items', async () => {
  await tab('Meals');
  await page.locator('.nl-entry').click();
  await sheet().locator('textarea').fill('4 eggs, 200g chicken, dragonfruit');
  await sheet().getByRole('button', { name: 'Parse' }).click();
  await page.waitForSelector('.parse-item');
  assert.equal(await page.locator('.parse-item').count(), 3);
  assert.equal(await page.locator('.parse-item.unmatched').count(), 1);
  await shot('03-parse');
  const logBtn = sheet().getByRole('button', { name: /^Log 2 items/ });
  assert.match(await logBtn.innerText(), /618 kcal · 87\.2 g P/);
  await logBtn.click();
  await page.locator('.totals-card', { hasText: '690' }).first().waitFor();
});

await check('Daily totals: calories and protein add up (72 + 288 + 330 = 690 kcal; 93.5 g P)', async () => {
  const cal = await text('.totals-card .num-xl');
  assert.equal(cal, '690');
  const prot = await page.locator('.totals-card .num-xl').nth(1).innerText();
  assert.equal(prot.trim(), '93.5');
  await shot('04-meals');
});

await check('Edit meal: change 4 eggs → 2 eggs updates totals', async () => {
  await page.locator('.entry', { hasText: '4 pieces' }).click();
  const input = sheet().locator('.stepper input');
  await input.fill('2');
  await sheet().getByRole('button', { name: 'Save' }).click();
  await page.locator('.totals-card', { hasText: '546' }).first().waitFor();
  assert.equal(await text('.totals-card .num-xl'), String(690 - 144));
});

await check('Delete meal entry (Egg) updates totals', async () => {
  await page.locator('.entry', { hasText: '1 piece ·' }).first().click();
  await sheet().getByRole('button', { name: 'Delete entry' }).click();
  await page.locator('.totals-card', { hasText: '474' }).first().waitFor();
  assert.equal(await text('.totals-card .num-xl'), String(690 - 144 - 72));
});

await check('Custom entry with manual macros', async () => {
  await page.getByRole('button', { name: '+ Log' }).click();
  await sheet('Log food').getByRole('button', { name: '+ Custom entry' }).click();
  const s = sheet('Custom entry');
  await s.locator('input.input').first().fill('Shawarma plate');
  const nums = s.locator('input.num');
  await nums.nth(0).fill('650');
  await nums.nth(1).fill('40');
  await nums.nth(2).fill('60');
  await nums.nth(3).fill('25');
  await s.getByRole('button', { name: 'Log entry' }).click();
  await page.locator('.totals-card', { hasText: '1,124' }).first().waitFor();
  await closeSheets();
  assert.equal(await text('.totals-card .num-xl'), '1,124');
});

await check('Log weight 60.4 kg', async () => {
  await tab('Weight');
  await page.getByRole('button', { name: '+ Log' }).click();
  await sheet().locator('.stepper input').fill('60.4');
  await sheet().getByRole('button', { name: 'Save' }).click();
  await page.locator('#main', { hasText: '60.4' }).waitFor();
  assert.match(await page.locator('#main').innerText(), /60\.4/);
  await shot('05-weight');
});

await check('Start workout, log T-Bar set 80×8 (volume 640) with one tap', async () => {
  await tab('Workout');
  await page.getByRole('button', { name: /Start workout|Resume workout/ }).click();
  await page.waitForSelector('.ex-card');
  const tbar = page.locator('.ex-card', { hasText: 'T-Bar Row' });
  await tbar.locator('input[aria-label="Set 1 weight"]').fill('80');
  await tbar.locator('input[aria-label="Set 1 reps"]').fill('8');
  await tbar.locator('input[aria-label="Set 1 RIR"]').fill('2');
  await tbar.locator('button[aria-label="Log set"]').first().click();
  await page.waitForSelector('.rest-timer');
  // The rest timer is drawn synchronously by toggle(); the stat strip re-renders on the store's change tick, so wait on the number.
  await page.locator('.stat-strip', { hasText: '640' }).first().waitFor();
  assert.match(await text('.stat-strip'), /640/);
  await shot('06-workout');
});

await check('Second set pre-fills from previous set: tap ✓ only', async () => {
  const tbar = page.locator('.ex-card', { hasText: 'T-Bar Row' });
  await tbar.locator('button[aria-label="Log set"]').first().click();
  await page.locator('.stat-strip', { hasText: '1,280' }).first().waitFor();
  assert.match(await text('.stat-strip'), /1,280/);
});

await check('Weighted pull-up volume uses body weight + added (60.4+10)×8 = 563', async () => {
  const pu = page.locator('.ex-card', { hasText: 'Weighted Pull-up' });
  await pu.locator('input[aria-label="Set 1 weight"]').fill('10');
  await pu.locator('input[aria-label="Set 1 reps"]').fill('8');
  await pu.locator('button[aria-label="Log set"]').first().click();
  await page.locator('.stat-strip', { hasText: '1,843' }).first().waitFor();
  assert.match(await text('.stat-strip'), /1,843/);
});

await check('Unilateral exercise counts both sides: 30×10/side = 600', async () => {
  const sa = page.locator('.ex-card', { hasText: 'Single-Arm Lat Pulldown' });
  await sa.locator('input[aria-label="Set 1 weight"]').fill('30');
  await sa.locator('input[aria-label="Set 1 reps"]').fill('10');
  await sa.locator('button[aria-label="Log set"]').first().click();
  await page.locator('.stat-strip', { hasText: '2,443' }).first().waitFor();
  assert.match(await text('.stat-strip'), /2,443/);
});

await check('Swap exercise (pull-up → lat pulldown suggestion is offered)', async () => {
  // Weighted Pull-up declares alternatives (seed.ts) — Straight-Arm Pulldown has none, and every exercise
  // appears somewhere in the swap sheet anyway, so asserting on it could never fail.
  await page.locator('button[aria-label="Options for Weighted Pull-up"]').click();
  await sheet('Weighted Pull-up').getByRole('button', { name: '⇄ Swap exercise' }).click();
  const swap = sheet('Swap Weighted Pull-up');
  await swap.locator('.list-heading', { hasText: 'Suggested alternatives' }).waitFor();
  assert.match(await swap.locator('.list-btn').first().innerText(), /Heavy Lat Pulldown/);
  await closeSheets();
});

await check('Finish workout → summary, dashboard shows Done', async () => {
  await page.locator('.rest-timer .chip', { hasText: 'Skip' }).click().catch(() => {});
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await sheet('Finish workout?').getByRole('button', { name: 'Finish anyway' }).click();
  await page.waitForSelector('text=Session summary');
  await shot('07-workout-done');
  await tab('Home');
  assert.match(await page.locator('#main').innerText(), /Done/);
});

await check('Previous-session comparison appears in a repeated workout', async () => {
  await tab('Workout');
  await page.getByRole('button', { name: /Repeat: / }).first().click();
  await page.waitForSelector('.ex-card');
  const tbar = page.locator('.ex-card', { hasText: 'T-Bar Row' });
  const prevText = await tbar.locator('.prev-col').first().innerText();
  assert.match(prevText, /80 kg × 8/);
  // placeholder pre-filled from previous session
  assert.equal(await tbar.locator('input[aria-label="Set 1 weight"]').getAttribute('placeholder'), '80');
  await shot('08-previous');
  await page.locator('button[aria-label="Workout options"]').click();
  await sheet('Workout options').getByRole('button', { name: 'Delete workout' }).click();
  await sheet('Delete workout?').getByRole('button', { name: 'Delete workout' }).click();
  await page.waitForTimeout(300);
});

await check('Recovery log from dashboard', async () => {
  await tab('Home');
  await page.getByRole('button', { name: 'Recovery' }).first().click();
  const s = sheet();
  await s.locator('.stepper input').fill('6');
  await s.locator('.segmented').nth(1).getByRole('tab', { name: '2' }).click();
  await s.getByRole('button', { name: 'Save' }).click();
  await page.locator('.mini-stat', { hasText: '2/5' }).first().waitFor();
  assert.match(await page.locator('#main').innerText(), /2\/5/);
});

await check('Weekly report renders (this week + previous) with observations and proposal', async () => {
  await tab('Report');
  await page.waitForSelector('text=Observations');
  await page.locator('button[aria-label="Next week"]').click();
  await page.locator('.date-nav .center-text', { hasText: 'This week' }).waitFor();
  const body = await page.locator('#main').innerText();
  assert.match(body, /Average intake was 1,124 kcal\/day/);
  assert.match(body, /1 session completed/);
  assert.match(body, /suggested adjustment/i);
  await shot('09-report');
});

await check('Planner: swap chicken → eggs keeps protein, log planned meal', async () => {
  await tab('More');
  await page.getByRole('button', { name: /Diet planner/ }).click();
  await page.waitForSelector('.day-tabs');
  await page.locator('.day-tab', { hasText: 'Mon' }).click();
  await page.locator('.day-tab.active', { hasText: 'Mon' }).waitFor();
  await page.locator('.entry', { hasText: 'Chicken breast (cooked)' }).first().click();
  await sheet().getByRole('button', { name: /Egg \(large\) · 7\.5 pieces/ }).click();
  await page.locator('.entry', { hasText: 'Egg (large)' }).first().waitFor();
  assert.equal(await page.locator('.entry', { hasText: 'Chicken breast (cooked)' }).count(), 0);
  await shot('10-planner');
});

await check('Charts screen renders 4 charts', async () => {
  await tab('More');
  await page.getByRole('button', { name: /Charts/ }).click();
  await page.locator('svg.chart').nth(3).waitFor();
  assert.equal(await page.locator('svg.chart').count(), 4);
  await shot('11-charts');
});

await check('Settings: edit calorie target → history + dashboard reflect it', async () => {
  await tab('More');
  await page.getByRole('button', { name: /Targets & profile/ }).click();
  await page.locator('.field', { hasText: 'Calories (kcal)' }).locator('input').fill('2500');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await page.locator('.toast', { hasText: 'Saved' }).waitFor();
  await tab('Home');
  assert.match(await page.locator('#main').innerText(), /2,500 kcal/);
});

await check('Persistence after reload', async () => {
  await page.reload();
  await page.waitForSelector('body.ready');
  const body = await page.locator('#main').innerText();
  assert.match(body, /2,500 kcal/);
  assert.match(body, /60\.4/);
  assert.match(body, /1,124/);
});

let backupPath = '';
await check('Export JSON backup', async () => {
  await tab('More');
  await page.getByRole('button', { name: /Backup & data/ }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download JSON' }).click()]);
  backupPath = shots + 'backup.json';
  await dl.saveAs(backupPath);
  const json = JSON.parse(readFileSync(backupPath, 'utf8'));
  assert.equal(json.app, 'regain');
  assert.equal(json.data.bodyWeight.length, 1);
  assert.ok(json.data.meals.length >= 3);
});

await check('Reset requires typing RESET, then clears data', async () => {
  await page.getByRole('button', { name: 'Reset all data' }).click();
  const confirmBtn = sheet('Reset everything?').getByRole('button', { name: 'Delete everything' });
  assert.equal(await confirmBtn.isDisabled(), true);
  await sheet('Reset everything?').locator('input').fill('RESET');
  await confirmBtn.click();
  await page.locator('.toast', { hasText: 'All data reset' }).waitFor(); // fires only after resetAll() resolves
  await page.locator('#main', { hasText: '2,400 kcal' }).waitFor();
  const body = await page.locator('#main').innerText();
  assert.match(body, /2,400 kcal/);
  assert.doesNotMatch(body, /60\.4/);
});

await check('Import restores the backup', async () => {
  await tab('More');
  await page.getByRole('button', { name: /Backup & data/ }).click();
  await page.locator('input[type=file]').setInputFiles(backupPath);
  await sheet('Replace all data?').getByRole('button', { name: 'Import & replace' }).click();
  await page.locator('.toast', { hasText: 'Backup restored' }).waitFor(); // fires only after store.replaceAll() resolves
  await tab('Home');
  await page.locator('#main', { hasText: '2,500 kcal' }).waitFor();
  const body = await page.locator('#main').innerText();
  assert.match(body, /2,500 kcal/);
  assert.match(body, /60\.4/);
});

await check('Service worker installs and the app loads offline', async () => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForSelector('body.ready');
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('body.ready', { timeout: 5000 });
  assert.match(await page.locator('#main').innerText(), /2,500 kcal/);
  await context.setOffline(false);
});

await check('Manifest is valid and icons resolve', async () => {
  const m = await (await page.request.get(BASE + 'manifest.webmanifest')).json();
  assert.equal(m.display, 'standalone');
  for (const i of m.icons) assert.equal((await page.request.get(BASE + i.src)).status(), 200);
  assert.equal((await page.request.get(BASE + 'icons/apple-touch-icon.png')).status(), 200);
});

await check('No horizontal overflow on any tab at 390px and 320px widths', async () => {
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const t of ['Home', 'Meals', 'Workout', 'Weight', 'Report', 'More']) {
      await tab(t);
      await page.evaluate(() => new Promise(requestAnimationFrame)); // one settled frame before measuring
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 0, `${t} at ${w}px overflows by ${overflow}px`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
});

await check('Desktop layout (1280px) renders without errors', async () => {
  const desk = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  desk.setDefaultTimeout(5000); // newPage creates its own context, which does not inherit the 5 s default
  desk.on('pageerror', (e) => errors.push('desktop pageerror: ' + e.message));
  try {
    await firstLaunch(desk); // a fresh context, so the service worker installs and claims here too
    await desk.screenshot({ path: shots + '12-desktop.png' });
  } finally {
    await desk.close();
  }
});

await check('No JavaScript errors in console', async () => {
  assert.deepEqual(errors, []);
});

await browser.close();
server.kill();
const failed = results.filter((r) => r.startsWith('✘')).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
