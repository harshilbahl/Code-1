import { uid } from '../../data/store.js';
import { formatDay } from '../../domain/dates.js';
import { RECOVERY_RULES, recoveryFlags, recoveryLast7 } from '../../domain/recovery.js';
import type { RecoveryEntry } from '../../domain/types.js';
import { Card, Empty, Field, Header, NumInput, Score, Stepper } from '../components.js';
import { S, app } from '../context.js';
import { h } from '../h.js';
import { openSheet, toast } from '../overlay.js';

export function openRecovery(date: string): void {
  const store = S();
  const existing = store.all('recovery').find((r) => r.date === date);
  const e: RecoveryEntry = existing
    ? { ...existing }
    : { id: uid(), updatedAt: Date.now(), date, sleepHours: 7.5, sleepQuality: null, energy: null, soreness: null, stress: null, steps: null, waterL: null };
  openSheet(`Recovery · ${formatDay(date, app.today())}`, (s) => (
    <div class="stack">
      <Field label="Sleep (hours)">{Stepper({ value: e.sleepHours ?? 7.5, step: 0.5, min: 0, max: 16, decimals: 1, suffix: 'h', onChange: (v) => (e.sleepHours = v) })}</Field>
      <Score label="Sleep quality" value={e.sleepQuality} low="poor" high="great" onChange={(v) => (e.sleepQuality = v)} />
      <Score label="Energy" value={e.energy} low="drained" high="great" onChange={(v) => (e.energy = v)} />
      <Score label="Soreness" value={e.soreness} low="none" high="very sore" onChange={(v) => (e.soreness = v)} />
      <Score label="Stress" value={e.stress} low="calm" high="very stressed" onChange={(v) => (e.stress = v)} />
      <div class="grid2">
        <Field label="Steps (optional)">{NumInput({ value: e.steps, decimal: false, placeholder: '–', onInput: (v) => (e.steps = v) })}</Field>
        <Field label="Water, L (optional)">{NumInput({ value: e.waterL, placeholder: '–', onInput: (v) => (e.waterL = v) })}</Field>
      </div>
      <button
        type="button"
        class="btn btn-primary btn-lg"
        onClick={() => {
          store.put('recovery', e);
          const flags = recoveryFlags(e);
          toast(flags.length ? `Saved · flagged: ${flags.join(', ')}` : 'Recovery saved');
          s.close();
        }}
      >
        Save
      </button>
    </div>
  ));
}

export function RecoveryScreen(): Node {
  const store = S();
  const today = app.today();
  const entries = store.all('recovery').sort((a, b) => b.date.localeCompare(a.date));
  const s7 = recoveryLast7(entries, today);
  return (
    <div class="screen">
      <Header back title="Recovery" action={<button type="button" class="btn btn-primary btn-sm" onClick={() => openRecovery(today)}>Log today</button>} />
      <Card title="Last 7 days">
        <div class="grid3">
          <div class="mini-stat">
            <b>{s7.avgSleep ?? '–'}</b>
            <span>avg sleep h</span>
          </div>
          <div class="mini-stat">
            <b>{s7.avgEnergy ?? '–'}</b>
            <span>avg energy</span>
          </div>
          <div class="mini-stat">
            <b>{s7.avgSoreness ?? '–'}</b>
            <span>avg soreness</span>
          </div>
        </div>
        {s7.consistentlyUnderRecovered ? (
          <div class="alert">
            ⚠ Consistently under-recovered: {s7.flaggedDays} of {s7.loggedDays} logged days were flagged.
          </div>
        ) : (
          <div class="muted small">
            {s7.flaggedDays} of {s7.loggedDays} logged days flagged.
          </div>
        )}
        <p class="muted small">
          A day is flagged when sleep &lt; {RECOVERY_RULES.minSleepHours} h, sleep quality or energy ≤ {RECOVERY_RULES.lowScore}, or soreness or stress ≥ {RECOVERY_RULES.highScore}. “Consistent” = {RECOVERY_RULES.minFlaggedDays}+ flagged days and at least half of logged days.
        </p>
      </Card>
      <Card title="History">
        {entries.length ? (
          <ul class="entries">
            {entries.slice(0, 60).map((r) => {
              const flags = recoveryFlags(r);
              return (
                <li>
                  <button type="button" class="entry" onClick={() => openRecovery(r.date)}>
                    <div class="grow">
                      <div class="entry-name">{formatDay(r.date, today)}</div>
                      <div class="muted small">
                        Sleep {r.sleepHours ?? '–'} h ({r.sleepQuality ?? '–'}/5) · energy {r.energy ?? '–'} · soreness {r.soreness ?? '–'} · stress {r.stress ?? '–'}
                        {r.steps ? ` · ${r.steps.toLocaleString()} steps` : ''}
                      </div>
                    </div>
                    {flags.length ? <span class="pill pill-warn">flag</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="Nothing logged yet" body="Takes ~10 seconds a day." />
        )}
      </Card>
    </div>
  );
}
