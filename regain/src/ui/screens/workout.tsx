import { uid } from '../../data/store.js';
import { formatDay, weekday } from '../../domain/dates.js';
import { workoutFromTemplate } from '../../domain/seed.js';
import type { Exercise, MuscleGroup, Workout, WorkoutExercise, WorkoutSet, WorkoutTemplate } from '../../domain/types.js';
import {
  exercisePRs,
  formatSet,
  previousPerformance,
  restLabel,
  sessionPRs,
  sessionStats,
  setVolume,
  setsFor,
  targetLabel,
} from '../../domain/workout.js';
import { Card, Empty, Field, Header, NumInput, Pill, Ring, Stepper, fmtInt, signed } from '../components.js';
import { S, app, currentBodyweight, exerciseMap, todaysWorkout, workoutsSorted } from '../context.js';
import { h, cls } from '../h.js';
import { confirmSheet, openSheet, toast } from '../overlay.js';
import { nav } from '../router.js';
import { startRest } from '../restTimer.js';

/* ============================================================ actions */

export function startWorkoutFor(w: Workout | undefined): void {
  if (!w) return nav('workout');
  if (w.status === 'planned') S().put('workouts', { ...w, status: 'active', startedAt: Date.now() }, true);
  nav(`workout/${w.id}`);
}

function createWorkout(w: Workout) {
  S().put('workouts', w, true);
  ensureSets(w);
  S().emit();
  nav(`workout/${w.id}`);
}

function startFromTemplate(t: WorkoutTemplate) {
  const w = workoutFromTemplate(t, app.today(), uid, Date.now());
  createWorkout({ ...w, status: 'active', startedAt: Date.now() });
}

function repeatWorkout(src: Workout) {
  const w: Workout = {
    ...src,
    id: uid(),
    date: app.today(),
    status: 'active',
    startedAt: Date.now(),
    completedAt: null,
    notes: '',
    bodyweightKg: null,
    exercises: src.exercises.map((e) => ({ ...e, id: uid() })),
  };
  createWorkout(w);
}

function emptyWorkout() {
  const split = S().settings.split[weekday(app.today())] || 'Workout';
  createWorkout({
    id: uid(),
    updatedAt: Date.now(),
    date: app.today(),
    title: split,
    split,
    status: 'active',
    exercises: [],
    startedAt: Date.now(),
    completedAt: null,
    notes: '',
    bodyweightKg: null,
  });
}

/** Materialise target-set rows so every row can be logged with one tap. */
function ensureSets(w: Workout) {
  const all = S().all('workoutSets');
  for (const e of w.exercises) {
    const existing = setsFor(all, w.id, e.id);
    for (let i = existing.length; i < e.targetSets; i++) {
      S().put('workoutSets', newSet(w, e, i), true);
    }
  }
}

function newSet(w: Workout, e: WorkoutExercise, index: number): WorkoutSet {
  return {
    id: uid(),
    updatedAt: Date.now(),
    workoutId: w.id,
    workoutExerciseId: e.id,
    exerciseId: e.exerciseId,
    setIndex: index,
    weight: null,
    reps: null,
    rir: null,
    done: false,
    notes: '',
    completedAt: null,
  };
}

function saveWorkout(w: Workout, silent = false) {
  return S().put('workouts', w, silent);
}

/* ============================================================ list screen */

export function WorkoutListScreen(): Node {
  const store = S();
  const today = app.today();
  const current = todaysWorkout();
  const exMap = exerciseMap();
  const bw = currentBodyweight().kg;
  const sets = store.all('workoutSets');
  const history = workoutsSorted().filter((w) => w.status === 'done');
  const templates = store.all('workoutTemplates').sort((a, b) => a.name.localeCompare(b.name));
  const repeatables = [...new Map(history.map((w) => [w.title, w])).values()].slice(0, 6);
  const scheduled = store.settings.split[weekday(today)];

  return (
    <div class="screen">
      <Header title="Workout" subtitle={scheduled ? `Scheduled today: ${scheduled}` : 'No split day scheduled today'} />

      {current && current.status !== 'done' ? (
        <Card class="hero-card" onClick={() => startWorkoutFor(current)}>
          <div class="row gap center">
            <Ring value={sessionStats(current, sets, exMap, bw).completion} size={72} />
            <div class="grow">
              <div class="eyebrow">{current.status === 'active' ? 'In progress' : 'Today'}</div>
              <div class="workout-title">{current.title}</div>
              <div class="muted small">
                {current.exercises.length} exercises · {sessionStats(current, sets, exMap, bw).plannedSets} planned sets
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-lg full">
            {current.status === 'active' ? 'Resume workout' : 'Start workout'}
          </button>
        </Card>
      ) : null}

      <Card title="Start a session">
        <div class="stack">
          {templates.map((t) => (
            <button type="button" class="list-btn" onClick={() => startFromTemplate(t)}>
              <div class="grow">
                <div>{t.name}</div>
                <div class="muted small">Template · {t.exercises.length} exercises</div>
              </div>
              <span class="muted">›</span>
            </button>
          ))}
          {repeatables.map((w) => (
            <button type="button" class="list-btn" onClick={() => repeatWorkout(w)}>
              <div class="grow">
                <div>Repeat: {w.title}</div>
                <div class="muted small">Last done {formatDay(w.date, today)}</div>
              </div>
              <span class="muted">↻</span>
            </button>
          ))}
          <button type="button" class="list-btn" onClick={emptyWorkout}>
            <div class="grow">
              <div>Empty workout</div>
              <div class="muted small">Add exercises as you go</div>
            </div>
            <span class="muted">+</span>
          </button>
        </div>
      </Card>

      <Card title="History">
        {history.length ? (
          <ul class="entries">
            {history.slice(0, 40).map((w) => {
              const s = sessionStats(w, sets, exMap, bw);
              return (
                <li>
                  <button type="button" class="entry" onClick={() => nav(`workout/${w.id}`)}>
                    <div class="grow">
                      <div class="entry-name">{w.title}</div>
                      <div class="muted small">
                        {formatDay(w.date, today)} · {s.totalSets} sets · {s.totalReps} reps
                      </div>
                    </div>
                    <div class="entry-kcal">{fmtInt(s.volume)} kg</div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="No completed workouts yet" body="Finished sessions show here with volume, and feed previous-session comparisons." />
        )}
      </Card>
    </div>
  );
}

/* ============================================================ detail screen */

export function WorkoutDetailScreen(id: string): Node {
  const store = S();
  const w = store.get('workouts', id);
  if (!w) return <div class="screen">{Empty({ title: 'Workout not found', action: <button class="btn btn-secondary" type="button" onClick={() => nav('workout')}>Back to workouts</button> })}</div>;
  if (w.status !== 'done') ensureSets(w);
  const exMap = exerciseMap();
  const bw = w.bodyweightKg ?? currentBodyweight().kg;
  const allSets = store.all('workoutSets');
  const workouts = store.all('workouts');
  const stats = sessionStats(w, allSets, exMap, bw);
  const prs = w.status === 'done' ? sessionPRs(w.id, workouts, allSets, exMap) : [];

  return (
    <div class="screen workout-screen">
      <Header
        back
        title={w.title}
        subtitle={`${formatDay(w.date, app.today())}${w.status === 'done' ? ' · completed' : w.status === 'active' ? ' · in progress' : ''}`}
        action={
          <button type="button" class="icon-btn" aria-label="Workout options" onClick={() => workoutMenu(w)}>
            ⋯
          </button>
        }
      />

      <div class="stat-strip">
        <Ring value={stats.completion} size={56} stroke={5} />
        <div>
          <b>
            {stats.totalSets}/{stats.plannedSets}
          </b>
          <span>sets</span>
        </div>
        <div>
          <b>{stats.totalReps}</b>
          <span>reps</span>
        </div>
        <div>
          <b>{fmtInt(stats.volume)}</b>
          <span>kg vol</span>
        </div>
      </div>

      {w.status === 'done' ? <SessionSummary w={w} prs={prs} /> : null}

      {w.exercises.map((we, idx) => (
        <ExerciseCard w={w} we={we} idx={idx} exercise={exMap.get(we.exerciseId)} bw={bw} />
      ))}

      <button type="button" class="btn btn-secondary full" onClick={() => pickExercise((ex) => addExercise(w, ex))}>
        + Add exercise
      </button>

      {w.status !== 'done' ? (
        <button type="button" class="btn btn-primary btn-lg full finish-btn" onClick={() => finishWorkout(w)}>
          Finish workout
        </button>
      ) : (
        <button
          type="button"
          class="btn btn-ghost full"
          onClick={() => {
            saveWorkout({ ...w, status: 'active', completedAt: null });
            toast('Workout reopened');
          }}
        >
          Reopen to edit
        </button>
      )}
      <p class="muted small center-text volume-note">
        Volume = weight × reps. Unilateral exercises: reps are per side, volume counts both sides (× 2). Pull-ups/dips: load = body weight ({bw.toFixed(1)} kg) + added weight.
      </p>
    </div>
  );
}

function SessionSummary(p: { w: Workout; prs: ReturnType<typeof sessionPRs> }): Node {
  const exMap = exerciseMap();
  const allSets = S().all('workoutSets');
  const workouts = S().all('workouts');
  const bw = p.w.bodyweightKg ?? currentBodyweight().kg;
  const rows = p.w.exercises.map((we) => {
    const ex = exMap.get(we.exerciseId);
    const cur = setsFor(allSets, p.w.id, we.id).filter((s) => s.done);
    const vol = Math.round(cur.reduce((v, s) => v + setVolume(s, ex, bw), 0));
    const prev = previousPerformance(we.exerciseId, p.w, workouts, allSets, ex);
    return { name: ex?.name ?? 'Exercise', vol, prev: prev?.volume ?? null, sets: cur.length };
  });
  const minutes = p.w.startedAt && p.w.completedAt ? Math.round((p.w.completedAt - p.w.startedAt) / 60000) : null;
  return (
    <Card title="Session summary" action={minutes ? <span class="muted small">{minutes} min</span> : null}>
      {p.prs.length ? (
        <div class="pr-list">
          {p.prs.map((pr) => (
            <div class="pr">
              🏆 {exMap.get(pr.exerciseId)?.name}: {pr.kinds.map((k) => (k === 'weight' ? 'heaviest load' : k === 'e1rm' ? 'best est. 1RM' : 'best set volume')).join(', ')}
            </div>
          ))}
        </div>
      ) : (
        <div class="muted small">No PRs this session (PRs are only claimed against a previous session).</div>
      )}
      <table class="table">
        <thead>
          <tr>
            <th>Exercise</th>
            <th class="r">Volume</th>
            <th class="r">vs prev</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((r) => r.sets > 0)
            .map((r) => (
              <tr>
                <td>{r.name}</td>
                <td class="r">{fmtInt(r.vol)}</td>
                <td class={cls('r', r.prev !== null && r.vol > r.prev && 'good', r.prev !== null && r.vol < r.prev && 'bad')}>
                  {r.prev === null ? 'new' : `${r.vol - r.prev >= 0 ? '+' : '−'}${fmtInt(Math.abs(r.vol - r.prev))}`}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </Card>
  );
}

function ExerciseCard(p: { w: Workout; we: WorkoutExercise; idx: number; exercise: Exercise | undefined; bw: number }): Node {
  const { w, we, exercise: ex } = p;
  const store = S();
  const allSets = store.all('workoutSets');
  const sets = setsFor(allSets, w.id, we.id);
  const prev = previousPerformance(we.exerciseId, w, store.all('workouts'), allSets, ex);
  const prs = exercisePRs(we.exerciseId, store.all('workouts').filter((x) => x.id !== w.id), allSets, ex);
  const doneCount = sets.filter((s) => s.done).length;
  const curVol = Math.round(sets.reduce((v, s) => v + setVolume(s, ex, p.bw), 0));

  return (
    <section class={cls('card ex-card', doneCount >= we.targetSets && 'complete', we.optional && 'optional')}>
      <div class="ex-head">
        <div class="grow">
          <div class="ex-name">
            {ex?.name ?? 'Unknown exercise'}
            {we.optional ? <Pill>optional</Pill> : null}
            {ex?.unilateral ? <Pill tone="accent">per side</Pill> : null}
            {ex?.bodyweight ? <Pill tone="accent">BW + added</Pill> : null}
          </div>
          <div class="muted small">
            {targetLabel(we)} · RIR {we.rirMin === we.rirMax ? we.rirMin : `${we.rirMin}–${we.rirMax}`} · rest {restLabel(we.restSec)}
          </div>
        </div>
        <button type="button" class="icon-btn" aria-label={`Options for ${ex?.name ?? 'exercise'}`} onClick={() => exerciseMenu(w, we)}>
          ⋯
        </button>
      </div>
      {we.notes ? <div class="ex-notes">{we.notes}</div> : null}

      <div class="prev-box">
        <div class="prev-col">
          <div class="eyebrow">Previous{prev ? ` · ${formatDay(prev.workout.date, app.today())}` : ''}</div>
          {prev ? (
            prev.sets.map((s) => <div class="prev-set">{formatSet(s, ex)}</div>)
          ) : (
            <div class="muted small">No previous session</div>
          )}
          {prev ? <div class="muted small">{fmtInt(prev.volume)} kg volume</div> : null}
        </div>
        <div class="prev-col">
          <div class="eyebrow">Current</div>
          {sets.filter((s) => s.done).length ? (
            sets.filter((s) => s.done).map((s) => <div class="prev-set">{formatSet(s, ex)}</div>)
          ) : (
            <div class="muted small">—</div>
          )}
          {doneCount ? (
            <div class={cls('small', prev && curVol > prev.volume ? 'good' : 'muted')}>
              {fmtInt(curVol)} kg{prev ? ` (${signed(curVol - prev.volume, 0)})` : ''}
            </div>
          ) : null}
        </div>
      </div>
      {prs.heaviest ? (
        <div class="muted small pr-line">
          PR: {prs.heaviest.load} kg × {prs.heaviest.reps}
          {prs.bestE1RM ? ` · est. 1RM ${prs.bestE1RM.value} kg` : ''}
        </div>
      ) : null}

      <div class="set-table">
        <div class="set-row set-head">
          <span>Set</span>
          <span>{ex?.bodyweight ? '+kg' : 'kg'}</span>
          <span>{ex?.unilateral ? 'reps/side' : 'reps'}</span>
          <span>RIR</span>
          <span />
        </div>
        {sets.map((s, i) => (
          <SetRow w={w} we={we} set={s} prevSet={prev?.sets[i] ?? (i > 0 ? sets[i - 1] : undefined)} />
        ))}
      </div>
      <div class="row gap">
        <button
          type="button"
          class="btn btn-ghost btn-sm grow"
          onClick={() => {
            store.put('workoutSets', newSet(w, we, sets.length));
          }}
        >
          + Add set
        </button>
      </div>
    </section>
  );
}

function SetRow(p: { w: Workout; we: WorkoutExercise; set: WorkoutSet; prevSet?: WorkoutSet }): Node {
  const { set } = p;
  const draft = { weight: set.weight, reps: set.reps, rir: set.rir };
  const ph = p.prevSet;
  const persist = () => S().put('workoutSets', { ...set, ...draft }, true);

  const weightIn = NumInput({ value: set.weight, placeholder: ph?.weight != null ? String(ph.weight) : '–', label: `Set ${set.setIndex + 1} weight`, class: 'set-in', onInput: (v) => ((draft.weight = v), persist()) });
  const repsIn = NumInput({ value: set.reps, decimal: false, placeholder: ph?.reps != null ? String(ph.reps) : '–', label: `Set ${set.setIndex + 1} reps`, class: 'set-in', onInput: (v) => ((draft.reps = v), persist()) });
  const rirIn = NumInput({ value: set.rir, decimal: false, placeholder: ph?.rir != null ? String(ph.rir) : String(p.we.rirMax), label: `Set ${set.setIndex + 1} RIR`, class: 'set-in', onInput: (v) => ((draft.rir = v), persist()) });

  const toggle = () => {
    if (set.done) {
      S().put('workoutSets', { ...set, ...draft, done: false, completedAt: null });
      return;
    }
    // Blank fields take the shown suggestion (previous session / previous set) → one-tap logging.
    const weight = draft.weight ?? ph?.weight ?? null;
    const reps = draft.reps ?? ph?.reps ?? null;
    const rir = draft.rir ?? ph?.rir ?? null;
    if (!reps || reps <= 0) {
      toast('Enter reps first');
      (repsIn as HTMLInputElement).focus();
      return;
    }
    const w = p.w.status === 'planned' ? saveWorkout({ ...p.w, status: 'active', startedAt: Date.now() }, true) : p.w;
    S().put('workoutSets', { ...set, weight: weight ?? 0, reps, rir, done: true, completedAt: Date.now() });
    const ex = S().get('exercises', set.exerciseId);
    if (w.status !== 'done') startRest(p.we.restSec, ex?.name ?? 'Rest');
  };

  return (
    <div class={cls('set-row', set.done && 'done')}>
      <button type="button" class="set-idx" aria-label={`Set ${set.setIndex + 1} options`} onClick={() => setMenu(set)}>
        {set.setIndex + 1}
      </button>
      {weightIn}
      {repsIn}
      {rirIn}
      <button type="button" class={cls('check-btn', set.done && 'on')} aria-label={set.done ? 'Mark set not done' : 'Log set'} aria-pressed={String(set.done)} onClick={toggle}>
        ✓
      </button>
    </div>
  );
}

/* ============================================================ menus */

function setMenu(set: WorkoutSet) {
  openSheet(`Set ${set.setIndex + 1}`, (s) => {
    let notes = set.notes;
    return (
      <div class="stack">
        <Field label="Notes">
          <input class="input" value={notes} placeholder="e.g. strap used, paused reps" onInput={(e: Event) => (notes = (e.target as HTMLInputElement).value)} />
        </Field>
        <button
          type="button"
          class="btn btn-primary"
          onClick={() => {
            S().put('workoutSets', { ...set, notes });
            s.close();
          }}
        >
          Save note
        </button>
        <button
          type="button"
          class="btn btn-danger-ghost"
          onClick={() => {
            const siblings = setsFor(S().all('workoutSets'), set.workoutId, set.workoutExerciseId).filter((x) => x.id !== set.id);
            S().remove('workoutSets', set.id, true);
            siblings.forEach((x, i) => x.setIndex !== i && S().put('workoutSets', { ...x, setIndex: i }, true));
            S().emit();
            s.close();
          }}
        >
          Delete set
        </button>
      </div>
    );
  });
}

function exerciseMenu(w: Workout, we: WorkoutExercise) {
  const ex = S().get('exercises', we.exerciseId);
  openSheet(ex?.name ?? 'Exercise', (s) => {
    const t = { ...we };
    const idx = w.exercises.findIndex((e) => e.id === we.id);
    const move = (dir: number) => {
      const list = [...w.exercises];
      const j = idx + dir;
      if (j < 0 || j >= list.length) return;
      [list[idx], list[j]] = [list[j], list[idx]];
      saveWorkout({ ...w, exercises: list });
      s.close();
    };
    return (
      <div class="stack">
        <button
          type="button"
          class="btn btn-secondary"
          onClick={() => {
            s.close();
            pickExercise((nx) => swapExercise(w, we, nx), ex);
          }}
        >
          ⇄ Swap exercise
        </button>
        <div class="grid2">
          <Field label="Sets">{Stepper({ value: t.targetSets, step: 1, min: 1, max: 12, onChange: (v) => (t.targetSets = v) })}</Field>
          <Field label="Rest (sec)">{Stepper({ value: t.restSec, step: 15, min: 15, max: 600, onChange: (v) => (t.restSec = v) })}</Field>
          <Field label="Reps min">{Stepper({ value: t.repMin, step: 1, min: 1, max: 50, onChange: (v) => (t.repMin = v) })}</Field>
          <Field label="Reps max">{Stepper({ value: t.repMax, step: 1, min: 1, max: 50, onChange: (v) => (t.repMax = v) })}</Field>
          <Field label="RIR min">{Stepper({ value: t.rirMin, step: 1, min: 0, max: 5, onChange: (v) => (t.rirMin = v) })}</Field>
          <Field label="RIR max">{Stepper({ value: t.rirMax, step: 1, min: 0, max: 5, onChange: (v) => (t.rirMax = v) })}</Field>
        </div>
        <Field label="Notes">
          <input class="input" value={t.notes} onInput={(e: Event) => (t.notes = (e.target as HTMLInputElement).value)} />
        </Field>
        <label class="check-row">
          <input type="checkbox" checked={t.optional} onChange={(e: Event) => (t.optional = (e.target as HTMLInputElement).checked)} /> Optional (excluded from completion %)
        </label>
        <button
          type="button"
          class="btn btn-primary"
          onClick={() => {
            if (t.repMax < t.repMin) t.repMax = t.repMin;
            if (t.rirMax < t.rirMin) t.rirMax = t.rirMin;
            saveWorkout({ ...w, exercises: w.exercises.map((e) => (e.id === we.id ? t : e)) }, true);
            ensureSets({ ...w, exercises: w.exercises.map((e) => (e.id === we.id ? t : e)) });
            S().emit();
            s.close();
          }}
        >
          Save changes
        </button>
        <div class="row gap">
          <button type="button" class="btn btn-ghost grow" disabled={idx === 0} onClick={() => move(-1)}>
            ↑ Move up
          </button>
          <button type="button" class="btn btn-ghost grow" disabled={idx === w.exercises.length - 1} onClick={() => move(1)}>
            ↓ Move down
          </button>
        </div>
        <button
          type="button"
          class="btn btn-danger-ghost"
          onClick={() =>
            confirmSheet({
              title: 'Remove exercise?',
              message: 'Its logged sets in this session are deleted too.',
              confirmLabel: 'Remove',
              danger: true,
              onConfirm: () => {
                S().removeWhere('workoutSets', (x) => x.workoutId === w.id && x.workoutExerciseId === we.id);
                saveWorkout({ ...w, exercises: w.exercises.filter((e) => e.id !== we.id) });
                s.close();
              },
            })
          }
        >
          Remove from workout
        </button>
      </div>
    );
  });
}

function swapExercise(w: Workout, we: WorkoutExercise, nx: Exercise) {
  saveWorkout({ ...w, exercises: w.exercises.map((e) => (e.id === we.id ? { ...e, exerciseId: nx.id } : e)) }, true);
  for (const s of S().all('workoutSets').filter((x) => x.workoutId === w.id && x.workoutExerciseId === we.id)) {
    S().put('workoutSets', { ...s, exerciseId: nx.id }, true);
  }
  S().emit();
  toast(`Swapped to ${nx.name}`);
}

function addExercise(w: Workout, ex: Exercise) {
  const we: WorkoutExercise = {
    id: uid(),
    exerciseId: ex.id,
    targetSets: 3,
    repMin: ex.compound ? 6 : 10,
    repMax: ex.compound ? 10 : 15,
    rirMin: 1,
    rirMax: 2,
    restSec: ex.compound ? 150 : 75,
    optional: false,
    notes: '',
  };
  const nw = { ...w, exercises: [...w.exercises, we] };
  saveWorkout(nw, true);
  ensureSets(nw);
  S().emit();
}

const MUSCLES: MuscleGroup[] = ['back', 'chest', 'shoulders', 'biceps', 'triceps', 'arms', 'quads', 'hamstrings', 'glutes', 'calves', 'traps', 'rear_delts', 'core', 'legs', 'other'];

export function pickExercise(onPick: (ex: Exercise) => void, current?: Exercise): void {
  openSheet(
    current ? `Swap ${current.name}` : 'Add exercise',
    (s) => {
      const list = (<div class="stack" />) as HTMLElement;
      const search = (<input class="input search" type="search" placeholder="Search exercises…" aria-label="Search exercises" />) as HTMLInputElement;
      const render = () => {
        const q = search.value.trim().toLowerCase();
        const all = S().all('exercises').sort((a, b) => a.name.localeCompare(b.name));
        const alts = current ? all.filter((e) => current.alternatives.includes(e.id)) : [];
        const same = current ? all.filter((e) => e.id !== current.id && e.muscleGroup === current.muscleGroup && !alts.includes(e)) : [];
        const rest = all.filter((e) => e.id !== current?.id && !alts.includes(e) && !same.includes(e));
        const filt = (xs: Exercise[]) => (q ? xs.filter((e) => e.name.toLowerCase().includes(q)) : xs);
        const btn = (e: Exercise) => (
          <button
            type="button"
            class="list-btn"
            onClick={() => {
              s.close();
              onPick(e);
            }}
          >
            <div class="grow">
              <div>{e.name}</div>
              <div class="muted small">
                {e.muscleGroup.replace('_', ' ')}
                {e.unilateral ? ' · per side' : ''}
                {e.bodyweight ? ' · bodyweight' : ''}
              </div>
            </div>
          </button>
        );
        list.replaceChildren(
          ...(filt(alts).length ? [<div class="list-heading">Suggested alternatives</div>, ...filt(alts).map(btn)] : []),
          ...(filt(same).length ? [<div class="list-heading">Same muscle group</div>, ...filt(same).map(btn)] : []),
          <div class="list-heading">All exercises</div>,
          ...filt(rest).map(btn),
        );
      };
      search.addEventListener('input', render);
      render();
      return (
        <div class="stack">
          {search}
          <button type="button" class="btn btn-secondary" onClick={() => newExerciseSheet(s.close, onPick)}>
            + New exercise
          </button>
          {list}
        </div>
      );
    },
    { tall: true },
  );
}

function newExerciseSheet(closeParent: () => void, onPick: (ex: Exercise) => void) {
  const ex: Exercise = { id: uid(), updatedAt: Date.now(), name: '', muscleGroup: 'back', unilateral: false, bodyweight: false, compound: false, alternatives: [] };
  openSheet('New exercise', (s) => (
    <div class="stack">
      <Field label="Name">
        <input class="input" placeholder="e.g. Meadows Row" onInput={(e: Event) => (ex.name = (e.target as HTMLInputElement).value)} />
      </Field>
      <Field label="Muscle group">
        <select class="input select" onChange={(e: Event) => (ex.muscleGroup = (e.target as HTMLSelectElement).value as MuscleGroup)}>
          {MUSCLES.map((m) => (
            <option value={m}>{m.replace('_', ' ')}</option>
          ))}
        </select>
      </Field>
      <label class="check-row">
        <input type="checkbox" onChange={(e: Event) => (ex.compound = (e.target as HTMLInputElement).checked)} /> Heavy compound (longer default rest)
      </label>
      <label class="check-row">
        <input type="checkbox" onChange={(e: Event) => (ex.unilateral = (e.target as HTMLInputElement).checked)} /> Unilateral — reps logged per side, volume × 2
      </label>
      <label class="check-row">
        <input type="checkbox" onChange={(e: Event) => (ex.bodyweight = (e.target as HTMLInputElement).checked)} /> Bodyweight — load = body weight + added weight
      </label>
      <button
        type="button"
        class="btn btn-primary"
        onClick={() => {
          if (!ex.name.trim()) return toast('Add a name');
          const saved = S().put('exercises', { ...ex, name: ex.name.trim() }, true);
          s.close();
          closeParent();
          onPick(saved);
        }}
      >
        Save & use
      </button>
    </div>
  ));
}

function workoutMenu(w: Workout) {
  openSheet('Workout options', (s) => {
    let title = w.title;
    let date = w.date;
    return (
      <div class="stack">
        <Field label="Name">
          <input class="input" value={title} onInput={(e: Event) => (title = (e.target as HTMLInputElement).value)} />
        </Field>
        <Field label="Date">
          <input class="input" type="date" value={date} onChange={(e: Event) => (date = (e.target as HTMLInputElement).value || date)} />
        </Field>
        <button
          type="button"
          class="btn btn-primary"
          onClick={() => {
            saveWorkout({ ...w, title: title.trim() || w.title, date });
            s.close();
          }}
        >
          Save
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          onClick={() => {
            const tpl: WorkoutTemplate = {
              id: uid(),
              updatedAt: Date.now(),
              name: w.title,
              split: w.split,
              exercises: w.exercises.map(({ id: _id, ...rest }) => rest),
            };
            S().put('workoutTemplates', tpl);
            toast('Saved as template');
            s.close();
          }}
        >
          Save as template
        </button>
        <button
          type="button"
          class="btn btn-danger-ghost"
          onClick={() =>
            confirmSheet({
              title: 'Delete workout?',
              message: 'This deletes the session and all its logged sets.',
              confirmLabel: 'Delete workout',
              danger: true,
              onConfirm: () => {
                S().removeWhere('workoutSets', (x) => x.workoutId === w.id);
                S().remove('workouts', w.id);
                s.close();
                nav('workout', { replace: true });
              },
            })
          }
        >
          Delete workout
        </button>
      </div>
    );
  });
}

function finishWorkout(w: Workout) {
  const sets = S().all('workoutSets').filter((s) => s.workoutId === w.id);
  const done = sets.filter((s) => s.done).length;
  const doFinish = () => {
    // Drop untouched empty rows so history only contains real sets.
    sets.filter((s) => !s.done && s.weight === null && s.reps === null).forEach((s) => S().remove('workoutSets', s.id, true));
    saveWorkout({ ...w, status: 'done', completedAt: Date.now(), bodyweightKg: currentBodyweight().kg });
    window.scrollTo({ top: 0 });
    toast('Workout complete 💪');
  };
  if (done === 0) return toast('Log at least one set first');
  const open = sets.filter((s) => !s.done).length;
  if (open > 0) {
    confirmSheet({
      title: 'Finish workout?',
      message: `${open} set${open === 1 ? '' : 's'} not logged. Unlogged empty sets will be removed.`,
      confirmLabel: 'Finish anyway',
      onConfirm: doFinish,
    });
  } else doFinish();
}
