import { makeBackup, validateBackup } from '../../data/backup.js';
import { addDays, dateKey, rangeDays, startOfWeek, weekdayLong, formatShort } from '../../domain/dates.js';
import { ACTIVITY_LABEL, estimateMaintenance } from '../../domain/energy.js';
import { dayTotals, mealsOn, servingLabel } from '../../domain/nutrition.js';
import type { ActivityLevel, Goal, Settings, Sex, UserProfile, Weekday } from '../../domain/types.js';
import { rollingSeries } from '../../domain/weight.js';
import { sessionStats } from '../../domain/workout.js';
import { BarChart, LineChart } from '../charts.js';
import { Card, EstPill, Field, Header, NumInput, Segmented, fmt1 } from '../components.js';
import { S, app, currentBodyweight, exerciseMap } from '../context.js';
import { h } from '../h.js';
import { confirmSheet, toast } from '../overlay.js';
import { nav } from '../router.js';
import { openFoodEditor } from './mealSheets.js';

export function MoreScreen(): Node {
  const item = (to: string, icon: string, title: string, sub: string) => (
    <button type="button" class="list-btn" onClick={() => nav(to)}>
      <span class="list-icon">{icon}</span>
      <div class="grow">
        <div>{title}</div>
        <div class="muted small">{sub}</div>
      </div>
      <span class="muted">›</span>
    </button>
  );
  return (
    <div class="screen">
      <Header title="More" />
      <Card>
        <div class="stack">
          {item('more/recovery', '☾', 'Recovery', 'Sleep, energy, soreness, stress')}
          {item('more/charts', '📈', 'Charts', 'Weight, calories, protein, volume')}
          {item('more/planner', '🥗', 'Diet planner', 'Dairy-free weekly plan with swaps')}
          {item('more/foods', '🍳', 'Food database', 'Custom foods, favorites')}
        </div>
      </Card>
      <Card>
        <div class="stack">
          {item('more/settings', '🎯', 'Targets & profile', 'Calories, protein, goal, split')}
          {item('more/backup', '💾', 'Backup & data', 'Export, import, reset')}
          {item('more/install', '📱', 'Install on iPhone', 'Add to Home Screen')}
        </div>
      </Card>
      <p class="muted small center-text">
        ReGain v1 · data stored on this device ({app.storageKind}
        {app.persistent ? ', persistent' : ''})
      </p>
    </div>
  );
}

/* ============================================================ foods */

export function FoodsScreen(): Node {
  const foods = S()
    .all('foods')
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
  const list = (<ul class="entries" />) as HTMLElement;
  const search = (<input class="input search" type="search" placeholder="Search foods…" aria-label="Search foods" />) as HTMLInputElement;
  const render = () => {
    const q = search.value.trim().toLowerCase();
    list.replaceChildren(
      ...foods
        .filter((f) => !q || f.name.toLowerCase().includes(q) || f.aliases.some((a) => a.includes(q)))
        .map((f) => (
          <li>
            <div class="entry">
              <button
                type="button"
                class="star-btn"
                aria-label={f.favorite ? `Unfavorite ${f.name}` : `Favorite ${f.name}`}
                onClick={() => S().put('foods', { ...f, favorite: !f.favorite })}
              >
                {f.favorite ? '★' : '☆'}
              </button>
              <button type="button" class="grow entry-btn" onClick={() => openFoodEditor({ id: f.id })}>
                <div class="entry-name">
                  {f.name} {f.source === 'reference' ? EstPill() : null}
                </div>
                <div class="muted small">
                  {servingLabel(f)} · {f.calories} kcal · {fmt1(f.protein)} P · {fmt1(f.carbs)} C · {fmt1(f.fat)} F
                </div>
              </button>
            </div>
          </li>
        )),
    );
  };
  search.addEventListener('input', render);
  render();
  return (
    <div class="screen">
      <Header back title="Food database" subtitle={`${foods.length} foods · ★ = favorite`} action={<button type="button" class="btn btn-primary btn-sm" onClick={() => openFoodEditor({})}>+ New</button>} />
      <p class="muted small">
        {EstPill()} marks typical reference values (approximate). Edit a food to match your packaging and set “Pack label”.
      </p>
      {search}
      <Card>{list}</Card>
    </div>
  );
}

/* ============================================================ charts */

let chartRange: '7' | '30' = '30';

export function ChartsScreen(): Node {
  const store = S();
  const today = app.today();
  const settings = store.settings;
  const host = (<div class="stack" />) as HTMLElement;
  const draw = () => {
    const days = Number(chartRange);
    const start = addDays(today, -(days - 1));
    const dates = rangeDays(start, days);
    const bw = store.all('bodyWeight');
    const byDate = new Map(bw.map((e) => [e.date, e.weightKg]));
    const meals = store.all('meals');
    const logged = (d: string) => mealsOn(meals, d).length > 0;
    // weekly volume, last 8 weeks
    const exMap = exerciseMap();
    const sets = store.all('workoutSets');
    const ws0 = startOfWeek(today, settings.weekStartsOn);
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(ws0, -7 * (7 - i)));
    const bwKg = currentBodyweight().kg;
    const vol = weeks.map((ws) => ({
      x: ws,
      label: formatShort(ws),
      y: store
        .all('workouts')
        .filter((w) => w.status === 'done' && w.date >= ws && w.date <= addDays(ws, 6))
        .reduce((v, w) => v + sessionStats(w, sets, exMap, bwKg).volume, 0),
    }));
    host.replaceChildren(
      <Card title={`Weight · ${days} days`}>{LineChart({ daily: dates.map((d) => ({ x: d, y: byDate.get(d) ?? null })), avg: rollingSeries(bw, start, today).map((p) => ({ x: p.date, y: p.value })), unit: 'kg' })}</Card>,
      <Card title="Calories vs target" action={<span class="muted small">unlogged days blank</span>}>
        {BarChart({ bars: dates.map((d) => ({ x: d, y: logged(d) ? dayTotals(meals, d).calories : null })), target: settings.calorieTarget, unit: 'kcal', name: 'Calories' })}
      </Card>,
      <Card title="Protein vs target">{BarChart({ bars: dates.map((d) => ({ x: d, y: logged(d) ? dayTotals(meals, d).protein : null })), target: settings.proteinTarget, unit: 'g', tone: 'protein', name: 'Protein' })}</Card>,
      <Card title="Weekly training volume" action={<span class="muted small">kg, last 8 weeks</span>}>
        {BarChart({ bars: vol, unit: 'kg', name: 'Weekly volume' })}
      </Card>,
    );
  };
  draw();
  return (
    <div class="screen">
      <Header
        back
        title="Charts"
        action={Segmented({
          options: [
            { value: '7', label: '7d' },
            { value: '30', label: '30d' },
          ],
          value: chartRange,
          onChange: (v) => {
            chartRange = v as typeof chartRange;
            draw();
          },
          class: 'seg-sm',
        })}
      />
      {host}
      <p class="muted small center-text">Tap a chart to read exact values.</p>
    </div>
  );
}

/* ============================================================ settings */

export function SettingsScreen(): Node {
  const store = S();
  const s: Settings = JSON.parse(JSON.stringify(store.settings));
  const p: UserProfile = { ...store.profile };
  const bw = currentBodyweight();
  const estimateEl = (<div class="small" />) as HTMLElement;
  const refreshEstimate = () => {
    const est = estimateMaintenance(bw.kg, p.heightCm, p.age, p.sex, s.activityLevel);
    estimateEl.replaceChildren(
      est === null ? (
        <span class="muted">Set sex (for the equation) to see a maintenance estimate.</span>
      ) : (
        <span>
          Estimated maintenance ≈ <b>{est.toLocaleString()} kcal</b> <span class="muted">(Mifflin-St Jeor × activity, at {bw.kg.toFixed(1)} kg). A population estimate — often off by ±10%. Your weekly trend is the real test.</span>
        </span>
      ),
    );
  };
  refreshEstimate();

  const save = () => {
    if (!(s.calorieTarget >= 1000 && s.calorieTarget <= 6000)) return toast('Calorie target should be 1,000–6,000');
    if (!(s.proteinTarget >= 30 && s.proteinTarget <= 400)) return toast('Protein target should be 30–400 g');
    const prev = store.settings;
    const changed = prev.calorieTarget !== s.calorieTarget || prev.proteinTarget !== s.proteinTarget;
    const history = changed ? [...s.targetHistory, { date: dateKey(), calories: s.calorieTarget, protein: s.proteinTarget, reason: 'Manual edit' }] : s.targetHistory;
    store.put('userProfile', p, true);
    store.put('settings', { ...s, targetHistory: history });
    toast('Saved');
  };

  const days: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div class="screen">
      <Header back title="Targets & profile" />
      <Card title="Daily targets">
        <div class="grid2">
          <Field label="Calories (kcal)">{NumInput({ value: s.calorieTarget, decimal: false, onInput: (v) => (s.calorieTarget = v ?? 0) })}</Field>
          <Field label="Protein (g)">{NumInput({ value: s.proteinTarget, decimal: false, onInput: (v) => (s.proteinTarget = v ?? 0) })}</Field>
          <Field label="Carbs (g, optional)">{NumInput({ value: s.carbTarget, decimal: false, placeholder: 'none', onInput: (v) => (s.carbTarget = v) })}</Field>
          <Field label="Fat (g, optional)">{NumInput({ value: s.fatTarget, decimal: false, placeholder: 'none', onInput: (v) => (s.fatTarget = v) })}</Field>
        </div>
        <p class="muted small">The starting calorie target is an editable estimate, not a prescription. Weekly reports suggest changes from your actual weight trend; you approve them.</p>
        <Field label="Goal">
          {Segmented({
            options: [
              { value: 'gain', label: 'Gain' },
              { value: 'maintain', label: 'Maintain' },
              { value: 'lose', label: 'Lose' },
            ],
            value: s.goal,
            onChange: (v) => (s.goal = v as Goal),
          })}
        </Field>
        <Field label="Activity level">
          <select
            class="input select"
            onChange={(e: Event) => {
              s.activityLevel = (e.target as HTMLSelectElement).value as ActivityLevel;
              refreshEstimate();
            }}
          >
            {(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((a) => (
              <option value={a} selected={a === s.activityLevel}>
                {ACTIVITY_LABEL[a]}
              </option>
            ))}
          </select>
        </Field>
        {estimateEl}
        <Field label="“Target reached” threshold (%)" hint="A day counts as reaching target at this % or more.">
          {NumInput({ value: s.targetHitThreshold, decimal: false, onInput: (v) => (s.targetHitThreshold = v ?? 95) })}
        </Field>
      </Card>

      <Card title="Profile">
        <Field label="Name (optional)">
          <input class="input" value={p.name} onInput={(e: Event) => (p.name = (e.target as HTMLInputElement).value)} />
        </Field>
        <div class="grid2">
          <Field label="Age">{NumInput({ value: p.age, decimal: false, onInput: (v) => ((p.age = v ?? p.age), refreshEstimate()) })}</Field>
          <Field label="Height (cm)">{NumInput({ value: p.heightCm, onInput: (v) => ((p.heightCm = v ?? p.heightCm), refreshEstimate()) })}</Field>
          <Field label="Start weight (kg)">{NumInput({ value: p.startWeightKg, onInput: (v) => (p.startWeightKg = v ?? p.startWeightKg) })}</Field>
          <Field label="Training years">{NumInput({ value: p.trainingYears, decimal: false, onInput: (v) => (p.trainingYears = v ?? p.trainingYears) })}</Field>
        </div>
        <Field label="Sex (only used by the calorie estimate equation)">
          {Segmented({
            options: [
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'unspecified', label: 'Not set' },
            ],
            value: p.sex,
            onChange: (v) => {
              p.sex = v as Sex;
              refreshEstimate();
            },
          })}
        </Field>
        <Field label="Dietary notes">
          <input class="input" value={p.dietaryNotes} onInput={(e: Event) => (p.dietaryNotes = (e.target as HTMLInputElement).value)} />
        </Field>
      </Card>

      <Card title="Weekly split" action={<span class="muted small">blank = rest</span>}>
        {days.map((d) => (
          <div class="split-row">
            <span>{weekdayLong(d)}</span>
            <input class="input" value={s.split[d]} placeholder="Rest" onInput={(e: Event) => (s.split[d] = (e.target as HTMLInputElement).value)} />
          </div>
        ))}
        <Field label="Report week starts on">
          <select class="input select" onChange={(e: Event) => (s.weekStartsOn = Number((e.target as HTMLSelectElement).value) as Weekday)}>
            {days.map((d) => (
              <option value={String(d)} selected={d === s.weekStartsOn}>
                {weekdayLong(d)}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <button type="button" class="btn btn-primary btn-lg full" onClick={save}>
        Save settings
      </button>

      <Card title="Target history">
        <ul class="entries">
          {[...store.settings.targetHistory].reverse().map((t) => (
            <li class="entry static">
              <div class="grow">
                <div class="entry-name">
                  {t.calories.toLocaleString()} kcal · {t.protein} g protein
                </div>
                <div class="muted small">
                  {t.date} · {t.reason}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ============================================================ backup */

async function exportBackup(share: boolean) {
  await S().flush();
  const json = JSON.stringify(makeBackup(S().snapshot()), null, 2);
  const name = `regain-backup-${dateKey()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  const nav2 = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (share && nav2.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'ReGain backup' });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: name }) as HTMLAnchorElement;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(`Exported ${name}`);
}

export function BackupScreen(): Node {
  const store = S();
  const counts = {
    meals: store.all('meals').length,
    workouts: store.all('workouts').length,
    sets: store.all('workoutSets').length,
    weighIns: store.all('bodyWeight').length,
    recovery: store.all('recovery').length,
    foods: store.all('foods').length,
  };
  const fileIn = (<input type="file" accept="application/json,.json" class="hidden-file" aria-label="Choose backup file" />) as HTMLInputElement;
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0];
    fileIn.value = '';
    if (!f) return;
    let json: unknown;
    try {
      json = JSON.parse(await f.text());
    } catch {
      return toast('That file is not valid JSON');
    }
    const v = validateBackup(json);
    if (!v.ok || !v.backup) return toast(`Can't import: ${v.errors[0]}`, undefined, 6000);
    const b = v.backup;
    confirmSheet({
      title: 'Replace all data?',
      message: `Backup from ${new Date(b.exportedAt).toLocaleString()}: ${v.counts.meals ?? 0} meals, ${v.counts.workouts ?? 0} workouts, ${v.counts.bodyWeight ?? 0} weigh-ins. This REPLACES everything currently on this device.`,
      confirmLabel: 'Import & replace',
      danger: true,
      onConfirm: async () => {
        await store.replaceAll(b.data);
        if (!store.all('settings').length) await store.seedIfEmpty();
        toast('Backup restored');
      },
    });
  });

  return (
    <div class="screen">
      <Header back title="Backup & data" />
      <Card title="On this device">
        <div class="report-grid">
          <div>
            <span class="muted small">Meals</span>
            <b>{counts.meals}</b>
          </div>
          <div>
            <span class="muted small">Workouts / sets</span>
            <b>
              {counts.workouts} / {counts.sets}
            </b>
          </div>
          <div>
            <span class="muted small">Weigh-ins</span>
            <b>{counts.weighIns}</b>
          </div>
          <div>
            <span class="muted small">Recovery days</span>
            <b>{counts.recovery}</b>
          </div>
        </div>
        <p class="muted small">
          Stored in {app.storageKind} on this device only. iOS can clear website data for sites you haven’t opened in a while — installing to the Home Screen and exporting regularly protects you.
        </p>
      </Card>
      <Card title="Export">
        <div class="stack">
          <button type="button" class="btn btn-primary" onClick={() => exportBackup(true)}>
            Share / Save to Files
          </button>
          <button type="button" class="btn btn-secondary" onClick={() => exportBackup(false)}>
            Download JSON
          </button>
        </div>
      </Card>
      <Card title="Import">
        <p class="muted small">Restore a ReGain JSON backup. The file is validated before anything is changed.</p>
        {fileIn}
        <button type="button" class="btn btn-secondary full" onClick={() => fileIn.click()}>
          Choose backup file…
        </button>
      </Card>
      <Card title="Reset">
        <p class="muted small">Deletes all logs and restores the starter data. Export first.</p>
        <button
          type="button"
          class="btn btn-danger-ghost full"
          onClick={() =>
            confirmSheet({
              title: 'Reset everything?',
              message: 'All meals, workouts, weigh-ins, recovery logs, custom foods and settings on this device will be permanently deleted.',
              confirmLabel: 'Delete everything',
              danger: true,
              requireText: 'RESET',
              onConfirm: async () => {
                await store.resetAll();
                toast('All data reset');
                nav('dashboard', { replace: true });
              },
            })
          }
        >
          Reset all data
        </button>
      </Card>
    </div>
  );
}

/* ============================================================ install help */

export function InstallScreen(): Node {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (
    <div class="screen">
      <Header back title="Install on iPhone" />
      <Card>
        {standalone ? <div class="alert good">✓ You’re running ReGain as an installed app.</div> : null}
        <ol class="steps">
          <li>
            Open this site in <b>Safari</b> (not an in-app browser or file preview).
          </li>
          <li>
            Tap the <b>Share</b> button (square with an arrow).
          </li>
          <li>
            Scroll and tap <b>Add to Home Screen</b>, then <b>Add</b>.
          </li>
          <li>Open ReGain from the Home Screen icon. It runs full-screen and works offline.</li>
        </ol>
        <p class="muted small">Data lives on this device. Installed web apps get their own storage on iOS — if you used ReGain in Safari first, export a backup there and import it in the installed app.</p>
      </Card>
    </div>
  );
}
