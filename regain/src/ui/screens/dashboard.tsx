import { addDays, formatDay, startOfWeek, weekdayLong, weekday } from '../../domain/dates.js';
import { dayTotals } from '../../domain/nutrition.js';
import { recoveryFlags, recoveryLast7 } from '../../domain/recovery.js';
import { buildWeeklyReport } from '../../domain/report.js';
import { TREND_ARROW, weightTrend } from '../../domain/weight.js';
import { sessionStats } from '../../domain/workout.js';
import { Card, Progress, Ring, fmt1, fmtInt, fmtKg, signed } from '../components.js';
import { S, app, currentBodyweight, exerciseMap, todaysWorkout } from '../context.js';
import { h, cls } from '../h.js';
import { nav } from '../router.js';
import { openLogMeal } from './mealSheets.js';
import { openRecovery } from './recovery.js';
import { openLogWeight } from './weight.js';
import { startWorkoutFor } from './workout.js';

export function DashboardScreen(): Node {
  const store = S();
  const today = app.today();
  const settings = store.settings;
  const bw = store.all('bodyWeight');
  const trend = weightTrend(bw, today);
  const current = currentBodyweight();
  const totals = dayTotals(store.all('meals'), today);
  const w = todaysWorkout();
  const stats = w ? sessionStats(w, store.all('workoutSets'), exerciseMap(), current.kg) : null;
  const recToday = store.all('recovery').find((r) => r.date === today);
  const rec7 = recoveryLast7(store.all('recovery'), today);
  const scheduled = settings.split[weekday(today)];

  // Weekly report banner: last complete week with no decision recorded.
  const thisWeek = startOfWeek(today, settings.weekStartsOn);
  const lastWeek = addDays(thisWeek, -7);
  const decided = store.all('weeklyReports').some((r) => r.weekStart === lastWeek && r.status !== 'pending');
  const lastReport = buildWeeklyReport(
    {
      settings,
      meals: store.all('meals'),
      bodyWeight: bw,
      recovery: store.all('recovery'),
      workouts: store.all('workouts'),
      workoutSets: store.all('workoutSets'),
      exercises: store.all('exercises'),
    },
    lastWeek,
    today,
  );
  const hasLastWeekData = lastReport.nutrition.loggedDays > 0 || lastReport.body.weighIns > 0 || lastReport.training.sessions > 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = store.profile.name;

  return (
    <div class="screen">
      <header class="hero-head">
        <div class="muted small">{weekdayLong(weekday(today))}</div>
        <h1>
          {greeting}
          {name ? `, ${name}` : ''}
        </h1>
      </header>

      {hasLastWeekData && !decided ? (
        <button type="button" class="banner" onClick={() => nav(`report?week=${lastWeek}`)}>
          <span>📊 Last week’s report is ready</span>
          <span class="muted">Review ›</span>
        </button>
      ) : null}

      <div class="quick-actions">
        <button type="button" class="qa" onClick={() => openLogMeal()}>
          <span class="qa-icon">🍽</span>
          <span>Log meal</span>
        </button>
        <button type="button" class="qa" onClick={() => openLogWeight()}>
          <span class="qa-icon">⚖︎</span>
          <span>Log weight</span>
        </button>
        <button type="button" class="qa" onClick={() => startWorkoutFor(w)}>
          <span class="qa-icon">🏋</span>
          <span>{w?.status === 'active' ? 'Resume' : 'Start workout'}</span>
        </button>
        <button type="button" class="qa" onClick={() => openRecovery(today)}>
          <span class="qa-icon">☾</span>
          <span>Recovery</span>
        </button>
      </div>

      <Card title="Weight" action={<span class="muted small">7-day avg drives decisions</span>} onClick={() => nav('weight')}>
        <div class="weight-row">
          <div>
            <div class="big-number">
              {fmtKg(current.kg)}
              <span class="unit">kg</span>
            </div>
            <div class="muted small">{current.logged ? 'Latest weigh-in' : 'Profile estimate — log a weigh-in'}</div>
          </div>
          <div class="weight-side">
            <div class="kv">
              <span class="muted">7-day avg</span>
              <b>{trend.current.average !== null ? `${fmtKg(trend.current.average, 2)} kg` : `${trend.current.count}/3 weigh-ins`}</b>
            </div>
            <div class="kv">
              <span class="muted">Trend</span>
              <b class={cls('trend', `trend-${trend.trend}`)}>
                {TREND_ARROW[trend.trend]} {trend.change !== null ? `${signed(trend.change, 2)} kg/wk` : 'need 2 wks'}
              </b>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Nutrition · today" onClick={() => nav('meals')}>
        <div class="macro-block">
          <div class="row between baseline">
            <span class="muted">Calories</span>
            <span>
              <b class="num-lg">{fmtInt(totals.calories)}</b>
              <span class="muted"> / {fmtInt(settings.calorieTarget)} kcal</span>
            </span>
          </div>
          <Progress value={totals.calories} max={settings.calorieTarget} tone="accent" label="Calories" />
        </div>
        <div class="macro-block">
          <div class="row between baseline">
            <span class="muted">Protein</span>
            <span>
              <b class="num-lg">{fmt1(totals.protein)}</b>
              <span class="muted"> / {settings.proteinTarget} g</span>
            </span>
          </div>
          <Progress value={totals.protein} max={settings.proteinTarget} tone="protein" label="Protein" />
        </div>
        <div class="grid2 tight">
          <div>
            <div class="row between baseline">
              <span class="muted">Carbs</span>
              <b>
                {fmtInt(totals.carbs)} g{settings.carbTarget ? <span class="muted"> / {settings.carbTarget}</span> : null}
              </b>
            </div>
            {settings.carbTarget ? <Progress value={totals.carbs} max={settings.carbTarget} tone="carbs" label="Carbs" /> : null}
          </div>
          <div>
            <div class="row between baseline">
              <span class="muted">Fat</span>
              <b>
                {fmtInt(totals.fat)} g{settings.fatTarget ? <span class="muted"> / {settings.fatTarget}</span> : null}
              </b>
            </div>
            {settings.fatTarget ? <Progress value={totals.fat} max={settings.fatTarget} tone="fat" label="Fat" /> : null}
          </div>
        </div>
        <div class="muted small">
          {Math.max(0, settings.calorieTarget - totals.calories).toLocaleString()} kcal and {fmt1(Math.max(0, settings.proteinTarget - totals.protein))} g protein to go
        </div>
      </Card>

      <Card title="Workout" onClick={() => (w ? nav(`workout/${w.id}`) : nav('workout'))}>
        {w && stats ? (
          <div class="row gap center">
            <Ring value={stats.completion} />
            <div class="grow">
              <div class="workout-title">{w.split ? w.split.toUpperCase() : w.title}</div>
              <div class="muted small">{w.title}</div>
              <div class="small">
                {stats.totalSets}/{stats.plannedSets} sets · {fmtInt(stats.volume)} kg volume
              </div>
            </div>
            <span class={cls('pill', w.status === 'done' ? 'pill-good' : w.status === 'active' ? 'pill-accent' : 'pill-muted')}>
              {w.status === 'done' ? 'Done' : w.status === 'active' ? 'In progress' : 'Planned'}
            </span>
          </div>
        ) : (
          <div class="row between center">
            <div>
              <div class="workout-title">{scheduled ? scheduled.toUpperCase() : 'REST DAY'}</div>
              <div class="muted small">{scheduled ? 'Scheduled in your split' : 'Nothing scheduled today'}</div>
            </div>
            <span class="muted">›</span>
          </div>
        )}
      </Card>

      <Card title="Recovery" action={<span class="muted small">{recToday ? formatDay(today) : 'Not logged today'}</span>} onClick={() => openRecovery(today)}>
        <div class="grid3">
          <div class="mini-stat">
            <b>{recToday?.sleepHours ?? '–'}</b>
            <span>h sleep</span>
          </div>
          <div class="mini-stat">
            <b>{recToday?.energy ?? '–'}/5</b>
            <span>energy</span>
          </div>
          <div class="mini-stat">
            <b>{recToday?.soreness ?? '–'}/5</b>
            <span>soreness</span>
          </div>
        </div>
        {rec7.consistentlyUnderRecovered ? (
          <div class="alert">
            ⚠ Under-recovered on {rec7.flaggedDays} of the last {rec7.loggedDays} logged days
            {recToday && recoveryFlags(recToday).length ? ` (today: ${recoveryFlags(recToday).join(', ')})` : ''}. Consider prioritising sleep and food before adding volume.
          </div>
        ) : rec7.loggedDays > 0 ? (
          <div class="muted small">
            Last 7 days: {rec7.loggedDays} logged · avg sleep {rec7.avgSleep ?? '–'} h · {rec7.flaggedDays} flagged day{rec7.flaggedDays === 1 ? '' : 's'}
          </div>
        ) : (
          <div class="muted small">Log sleep, energy and soreness daily to spot under-recovery.</div>
        )}
      </Card>
    </div>
  );
}
