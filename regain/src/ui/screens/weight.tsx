import { uid } from '../../data/store.js';
import { addDays, formatDay, formatShort, rangeDays, startOfWeek } from '../../domain/dates.js';
import type { BodyWeightEntry } from '../../domain/types.js';
import { TREND_ARROW, latestEntry, rollingSeries, sortedByDate, weeklyAverages, weightTrend } from '../../domain/weight.js';
import { LineChart } from '../charts.js';
import { Card, Empty, Field, Header, Segmented, Stat, Stepper, fmtKg, signed } from '../components.js';
import { S, app } from '../context.js';
import { h, cls } from '../h.js';
import { confirmSheet, openSheet, toast } from '../overlay.js';

let range: '7' | '30' | '90' = '30';

export function openLogWeight(existing?: BodyWeightEntry): void {
  const store = S();
  const today = app.today();
  const last = latestEntry(store.all('bodyWeight'));
  let date = existing?.date ?? today;
  let kg = existing?.weightKg ?? last?.weightKg ?? store.profile.startWeightKg;
  let note = existing?.note ?? '';
  openSheet(existing ? 'Edit weigh-in' : 'Log morning weight', (s) => (
    <div class="stack">
      <p class="muted small">Weigh after waking, after the bathroom, before food — same conditions each day.</p>
      <Field label="Weight (kg)">{Stepper({ value: kg, step: 0.1, min: 20, max: 300, decimals: 1, suffix: 'kg', label: 'Weight in kg', onChange: (v) => (kg = v) })}</Field>
      <Field label="Date">
        <input class="input" type="date" value={date} max={today} onChange={(e: Event) => (date = (e.target as HTMLInputElement).value || date)} />
      </Field>
      <Field label="Note (optional)">
        <input class="input" value={note} placeholder="e.g. salty dinner, poor sleep" onInput={(e: Event) => (note = (e.target as HTMLInputElement).value)} />
      </Field>
      <button
        type="button"
        class="btn btn-primary btn-lg"
        onClick={() => {
          if (!(kg > 20 && kg < 300)) return toast('Enter a valid weight');
          // One entry per day: logging again for the same date replaces it.
          const sameDay = store.all('bodyWeight').find((e) => e.date === date && e.id !== existing?.id);
          if (sameDay) store.remove('bodyWeight', sameDay.id, true);
          store.put('bodyWeight', { id: existing?.id ?? uid(), updatedAt: Date.now(), date, weightKg: Math.round(kg * 10) / 10, note: note.trim() });
          toast(`Saved ${kg.toFixed(1)} kg for ${formatDay(date, today)}`);
          s.close();
        }}
      >
        Save
      </button>
      {existing ? (
        <button
          type="button"
          class="btn btn-danger-ghost"
          onClick={() =>
            confirmSheet({
              title: 'Delete weigh-in?',
              message: `${existing.weightKg} kg on ${formatDay(existing.date, today)}`,
              confirmLabel: 'Delete',
              danger: true,
              onConfirm: () => {
                store.remove('bodyWeight', existing.id);
                s.close();
              },
            })
          }
        >
          Delete
        </button>
      ) : null}
    </div>
  ));
}

export function WeightScreen(): Node {
  const store = S();
  const today = app.today();
  const settings = store.settings;
  const entries = store.all('bodyWeight');
  const sorted = sortedByDate(entries);
  const latest = sorted[sorted.length - 1];
  const trend = weightTrend(entries, today);
  const startKg = sorted[0]?.weightKg ?? store.profile.startWeightKg;
  const thisWeek = startOfWeek(today, settings.weekStartsOn);
  const weeks = weeklyAverages(entries, thisWeek, 8);
  const cur = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];

  const chartHost = (<div />) as HTMLElement;
  const drawChart = () => {
    const days = Number(range);
    const start = addDays(today, -(days - 1));
    const byDate = new Map(entries.map((e) => [e.date, e.weightKg]));
    const daily = rangeDays(start, days).map((d) => ({ x: d, y: byDate.get(d) ?? null }));
    const avg = rollingSeries(entries, start, today).map((p) => ({ x: p.date, y: p.value }));
    chartHost.replaceChildren(LineChart({ daily, avg, unit: 'kg' }));
  };
  drawChart();

  return (
    <div class="screen">
      <Header title="Body weight" subtitle="Decisions use weekly averages, never one weigh-in" action={<button type="button" class="btn btn-primary btn-sm" onClick={() => openLogWeight()}>+ Log</button>} />

      <Card>
        <div class="grid2 tight">
          <Stat label="Latest" value={latest ? fmtKg(latest.weightKg) : '–'} unit="kg" sub={latest ? formatDay(latest.date, today) : 'No weigh-ins yet'} />
          <Stat
            label="7-day average"
            value={trend.current.average !== null ? fmtKg(trend.current.average, 2) : '–'}
            unit={trend.current.average !== null ? 'kg' : ''}
            sub={`${trend.current.count} weigh-in${trend.current.count === 1 ? '' : 's'} in last 7 days`}
          />
          <Stat
            label="Trend (7d vs prior 7d)"
            value={<span class={cls('trend', `trend-${trend.trend}`)}>{TREND_ARROW[trend.trend]}</span>}
            sub={trend.change !== null ? `${signed(trend.change, 2)} kg` : 'Needs 3+ weigh-ins in each week'}
          />
          <Stat label="Change from start" value={latest && trend.current.average !== null ? signed(trend.current.average - startKg, 1) : '–'} unit="kg" sub={`Start ${fmtKg(startKg)} kg${sorted.length ? '' : ' (profile)'}`} />
        </div>
      </Card>

      <Card title="Weekly averages">
        <div class="row between small">
          <span class="muted">This week ({formatShort(cur.weekStart)}–)</span>
          <b>{cur.average !== null ? `${cur.average.toFixed(2)} kg` : `${cur.count}/3 weigh-ins`}</b>
        </div>
        <div class="row between small">
          <span class="muted">Last week</span>
          <b>{prev.average !== null ? `${prev.average.toFixed(2)} kg` : `${prev.count}/3 weigh-ins`}</b>
        </div>
        <div class="row between small">
          <span class="muted">Change from previous week</span>
          <b>{cur.average !== null && prev.average !== null ? `${signed(cur.average - prev.average, 2)} kg` : '–'}</b>
        </div>
        <div class="week-bars">
          {weeks.map((wk) => (
            <div class="wk">
              <div class="wk-val">{wk.average !== null ? wk.average.toFixed(1) : '–'}</div>
              <div class="wk-lbl">{formatShort(wk.weekStart)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Trend"
        action={Segmented({
          options: [
            { value: '7', label: '7d' },
            { value: '30', label: '30d' },
            { value: '90', label: '90d' },
          ],
          value: range,
          onChange: (v) => {
            range = v as typeof range;
            drawChart();
          },
          class: 'seg-sm',
        })}
      >
        {chartHost}
      </Card>

      <Card title="Entries">
        {sorted.length ? (
          <ul class="entries">
            {[...sorted].reverse().slice(0, 60).map((e, i, arr) => {
              const older = arr[i + 1];
              return (
                <li>
                  <button type="button" class="entry" onClick={() => openLogWeight(e)}>
                    <div class="grow">
                      <div class="entry-name">{formatDay(e.date, today)}</div>
                      {e.note ? <div class="muted small">{e.note}</div> : null}
                    </div>
                    <div class="muted small">{older ? signed(e.weightKg - older.weightKg, 1) : ''}</div>
                    <div class="entry-kcal">{e.weightKg.toFixed(1)}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="No weigh-ins yet" body="Log a morning weight daily. After 3+ weigh-ins a 7-day average appears; after two weeks, a trend." />
        )}
      </Card>
    </div>
  );
}
