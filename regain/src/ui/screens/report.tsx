import { uid } from '../../data/store.js';
import { addDays, formatRange, startOfWeek, weekdayShort, weekday } from '../../domain/dates.js';
import { buildWeeklyReport } from '../../domain/report.js';
import type { WeeklyReportRecord } from '../../domain/types.js';
import { TREND_ARROW } from '../../domain/weight.js';
import { BarChart } from '../charts.js';
import { Card, Header, Pill, fmtInt, signed } from '../components.js';
import { S, app } from '../context.js';
import { h, cls } from '../h.js';
import { confirmSheet, toast } from '../overlay.js';
import { currentRoute, nav } from '../router.js';

export function ReportScreen(): Node {
  const store = S();
  const today = app.today();
  const settings = store.settings;
  const thisWeek = startOfWeek(today, settings.weekStartsOn);
  const q = currentRoute().query.get('week');
  const weekStart = q ? startOfWeek(q, settings.weekStartsOn) : addDays(thisWeek, -7);
  const r = buildWeeklyReport(
    {
      settings,
      meals: store.all('meals'),
      bodyWeight: store.all('bodyWeight'),
      recovery: store.all('recovery'),
      workouts: store.all('workouts'),
      workoutSets: store.all('workoutSets'),
      exercises: store.all('exercises'),
    },
    weekStart,
    today,
  );
  const record = store.all('weeklyReports').find((x) => x.weekStart === weekStart);
  const go = (ws: string) => nav(`report?week=${ws}`, { replace: true });
  const p = r.proposal;

  const decide = (status: 'approved' | 'declined') => {
    const rec: WeeklyReportRecord = {
      id: record?.id ?? uid(),
      updatedAt: Date.now(),
      weekStart,
      generatedAt: Date.now(),
      proposedCalories: p.proposedCalories,
      proposedProtein: null,
      proposalSummary: p.headline,
      status,
      decidedAt: Date.now(),
    };
    if (status === 'approved' && p.proposedCalories !== null) {
      store.put(
        'settings',
        {
          ...settings,
          calorieTarget: p.proposedCalories,
          targetHistory: [...settings.targetHistory, { date: today, calories: p.proposedCalories, protein: settings.proteinTarget, reason: `Weekly review ${formatRange(r.weekStart, r.weekEnd)}: ${p.headline}` }],
        },
        true,
      );
      toast(`Calorie target set to ${p.proposedCalories.toLocaleString()} kcal`);
    } else toast(status === 'approved' ? 'Noted — target unchanged' : 'Proposal declined — target unchanged');
    store.put('weeklyReports', rec);
  };

  return (
    <div class="screen">
      <Header title="Weekly report" subtitle={`${formatRange(r.weekStart, r.weekEnd)}${r.complete ? '' : ` · in progress (day ${r.daysElapsed}/7)`}`} />
      <div class="date-nav">
        <button type="button" class="icon-btn" aria-label="Previous week" onClick={() => go(addDays(weekStart, -7))}>
          ‹
        </button>
        <div class="grow center-text">{weekStart === thisWeek ? 'This week' : weekStart === addDays(thisWeek, -7) ? 'Last week' : formatRange(r.weekStart, r.weekEnd)}</div>
        <button type="button" class="icon-btn" aria-label="Next week" disabled={weekStart >= thisWeek} onClick={() => go(addDays(weekStart, 7))}>
          ›
        </button>
      </div>

      <Card title="Body weight">
        <div class="report-grid">
          <div>
            <span class="muted small">Start (prev. 7-day avg)</span>
            <b>{r.body.startAvg !== null ? `${r.body.startAvg.toFixed(2)} kg` : '–'}</b>
          </div>
          <div>
            <span class="muted small">End (7-day avg)</span>
            <b>{r.body.endAvg !== null ? `${r.body.endAvg.toFixed(2)} kg` : '–'}</b>
          </div>
          <div>
            <span class="muted small">Change</span>
            <b>{r.body.change !== null ? `${signed(r.body.change, 2)} kg` : '–'}</b>
          </div>
          <div>
            <span class="muted small">Trend</span>
            <b class={cls('trend', `trend-${r.body.trend}`)}>
              {TREND_ARROW[r.body.trend]} {r.body.trend === 'unknown' ? 'not enough data' : r.body.trend}
            </b>
          </div>
        </div>
      </Card>

      <Card title="Nutrition" action={<span class="muted small">{r.nutrition.loggedDays}/{r.daysElapsed} days logged</span>}>
        <div class="report-grid">
          <div>
            <span class="muted small">Avg calories</span>
            <b>{fmtInt(r.nutrition.avgCalories)} kcal</b>
          </div>
          <div>
            <span class="muted small">Avg protein</span>
            <b>{fmtInt(r.nutrition.avgProtein)} g</b>
          </div>
          <div>
            <span class="muted small">Avg carbs</span>
            <b>{fmtInt(r.nutrition.avgCarbs)} g</b>
          </div>
          <div>
            <span class="muted small">Avg fat</span>
            <b>{fmtInt(r.nutrition.avgFat)} g</b>
          </div>
          <div>
            <span class="muted small">Calorie target hit</span>
            <b>
              {r.nutrition.calorieHitDays}/{r.nutrition.loggedDays} days
            </b>
          </div>
          <div>
            <span class="muted small">Protein target hit</span>
            <b>
              {r.nutrition.proteinHitDays}/{r.nutrition.loggedDays} days
            </b>
          </div>
        </div>
        {BarChart({
          bars: r.nutrition.daily.map((d) => ({ x: d.date, y: d.logged ? d.calories : null, label: weekdayShort(weekday(d.date)) })),
          target: settings.calorieTarget,
          unit: 'kcal',
          name: 'Daily calories',
          height: 140,
        })}
      </Card>

      <Card title="Training">
        <div class="report-grid">
          <div>
            <span class="muted small">Training days</span>
            <b>{r.training.trainingDays}</b>
          </div>
          <div>
            <span class="muted small">Rest days</span>
            <b>{r.training.restDays}</b>
          </div>
          <div>
            <span class="muted small">Working sets</span>
            <b>{r.training.sets}</b>
          </div>
          <div>
            <span class="muted small">Volume</span>
            <b>{fmtInt(r.training.volume)} kg</b>
          </div>
        </div>
        <div class="tag-row">{r.training.muscleGroups.length ? r.training.muscleGroups.map((g) => <Pill>{g.replace('_', ' ')}</Pill>) : <span class="muted small">No completed sessions</span>}</div>
      </Card>

      <Card title="Recovery">
        <div class="report-grid">
          <div>
            <span class="muted small">Avg sleep</span>
            <b>{r.recovery.avgSleep ?? '–'} h</b>
          </div>
          <div>
            <span class="muted small">Avg energy</span>
            <b>{r.recovery.avgEnergy ?? '–'}/5</b>
          </div>
          <div>
            <span class="muted small">Avg soreness</span>
            <b>{r.recovery.avgSoreness ?? '–'}/5</b>
          </div>
          <div>
            <span class="muted small">Flagged days</span>
            <b>
              {r.recovery.flaggedDays}/{r.recovery.loggedDays}
            </b>
          </div>
        </div>
      </Card>

      <Card title="Observations">
        <ul class="obs">
          {r.observations.map((o) => (
            <li>{o}</li>
          ))}
        </ul>
      </Card>

      <Card class={cls('proposal', `proposal-${p.kind}`)} title="Suggested adjustment" action={<Pill tone={p.confidence === 'moderate' ? 'accent' : 'muted'}>{p.confidence} confidence</Pill>}>
        <div class="proposal-head">{p.headline}</div>
        {p.proposedCalories !== null ? (
          <div class="proposal-numbers">
            <span class="muted">{settings.calorieTarget.toLocaleString()}</span>
            <span>→</span>
            <b>{p.proposedCalories.toLocaleString()} kcal/day</b>
            <span class="muted small">
              ({p.delta > 0 ? '+' : ''}
              {p.delta}; range {p.range?.[0]}–{p.range?.[1]})
            </span>
          </div>
        ) : null}
        <ul class="obs small">
          {p.reasons.map((x) => (
            <li>{x}</li>
          ))}
        </ul>
        <p class="muted small">This is a suggestion from simple rules applied to your logged data, not medical advice. Nothing changes unless you approve.</p>
        {record && record.status !== 'pending' ? (
          <div class="decision">
            {record.status === 'approved' ? '✓ Approved' : '✕ Declined'} on {new Date(record.decidedAt ?? 0).toLocaleDateString()}
          </div>
        ) : !r.complete ? (
          <div class="muted small">Approval opens when the week is complete.</div>
        ) : p.proposedCalories !== null ? (
          <div class="row gap">
            <button type="button" class="btn btn-ghost grow" onClick={() => decide('declined')}>
              Decline
            </button>
            <button
              type="button"
              class="btn btn-primary grow"
              onClick={() =>
                confirmSheet({
                  title: 'Change calorie target?',
                  message: `Set your daily target from ${settings.calorieTarget.toLocaleString()} to ${(p.proposedCalories as number).toLocaleString()} kcal. You can edit it any time in Settings.`,
                  confirmLabel: 'Approve',
                  onConfirm: () => decide('approved'),
                })
              }
            >
              Approve
            </button>
          </div>
        ) : (
          <button type="button" class="btn btn-secondary" onClick={() => decide('approved')}>
            Mark reviewed
          </button>
        )}
      </Card>
    </div>
  );
}
