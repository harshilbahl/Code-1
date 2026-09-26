import { weekday, weekdayShort } from '../../domain/dates.js';
import { MEAL_TYPE_LABEL, foodMacros, quantityLabel } from '../../domain/nutrition.js';
import { GROUP_LABEL, dayMacros, fitDayToTarget, itemMacros, mealMacros, substitute, substitutesFor } from '../../domain/planner.js';
import { defaultMealPlan } from '../../domain/seed.js';
import type { MealPlan, PlanItem, PlanMeal, Weekday } from '../../domain/types.js';
import { Card, EstPill, Field, Header, Progress, Stepper, fmt1, fmtInt } from '../components.js';
import { S, app, foodMap } from '../context.js';
import { h } from '../h.js';
import { confirmSheet, openSheet, toast } from '../overlay.js';
import { currentRoute, nav } from '../router.js';
import { logFood } from './mealSheets.js';

const ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

function plan(): MealPlan {
  const p = S().all('mealPlans')[0];
  if (p) return p;
  return S().put('mealPlans', { ...defaultMealPlan(), updatedAt: Date.now() }, true);
}

function savePlan(p: MealPlan) {
  S().put('mealPlans', p);
}

function updateMeal(p: MealPlan, wd: Weekday, mealIdx: number, fn: (m: PlanMeal) => PlanMeal): MealPlan {
  return { ...p, days: p.days.map((d) => (d.weekday === wd ? { ...d, meals: d.meals.map((m, i) => (i === mealIdx ? fn(m) : m)) } : d)) };
}

export function PlannerScreen(): Node {
  const store = S();
  const settings = store.settings;
  const foods = foodMap();
  const p = plan();
  const wd = (Number(currentRoute().query.get('day') ?? weekday(app.today())) as Weekday) ?? 1;
  const day = p.days.find((d) => d.weekday === wd) ?? p.days[0];
  const totals = dayMacros(day, foods);
  const isToday = wd === weekday(app.today());

  return (
    <div class="screen">
      <Header back title="Diet planner" subtitle="Dairy-free · high protein · easy meals" />
      <div class="day-tabs">
        {ORDER.map((d) => (
          <button type="button" class={'day-tab' + (d === wd ? ' active' : '')} onClick={() => nav(`more/planner?day=${d}`, { replace: true })}>
            {weekdayShort(d)}
          </button>
        ))}
      </div>

      <Card>
        <div class="row between baseline">
          <span class="muted">Plan total</span>
          <span>
            <b class="num-lg">{fmtInt(totals.calories)}</b>
            <span class="muted"> / {fmtInt(settings.calorieTarget)} kcal</span>
          </span>
        </div>
        <Progress value={totals.calories} max={settings.calorieTarget} />
        <div class="row between baseline">
          <span class="muted">Protein</span>
          <span>
            <b>{fmt1(totals.protein)}</b>
            <span class="muted"> / {settings.proteinTarget} g</span>
          </span>
        </div>
        <Progress value={totals.protein} max={settings.proteinTarget} tone="protein" />
        <div class="muted small">
          Carbs {fmtInt(totals.carbs)} g · Fat {fmtInt(totals.fat)} g · values use your food database {EstPill()}
        </div>
        <div class="row gap">
          <button
            type="button"
            class="btn btn-secondary grow btn-sm"
            onClick={() => {
              const fitted = fitDayToTarget(day, foods, settings.calorieTarget);
              savePlan({ ...p, days: p.days.map((d) => (d.weekday === wd ? fitted : d)) });
              toast(`Scaled carbs/fats to ≈${fmtInt(dayMacros(fitted, foods).calories)} kcal; protein foods unchanged`);
            }}
          >
            Fit to calorie target
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            onClick={() =>
              confirmSheet({
                title: 'Reset plan?',
                message: 'Restores the starter dairy-free plan for all 7 days.',
                confirmLabel: 'Reset plan',
                onConfirm: () => savePlan({ ...defaultMealPlan(), id: p.id, updatedAt: Date.now() }),
              })
            }
          >
            Reset
          </button>
        </div>
      </Card>

      {day.meals.map((meal, mi) => {
        const m = mealMacros(meal, foods);
        return (
          <Card
            title={
              <span>
                {MEAL_TYPE_LABEL[meal.mealType]} <span class="muted small">· {meal.title}</span>
              </span>
            }
            action={<span class="muted small">{m.calories} kcal · {fmt1(m.protein)} P</span>}
          >
            <ul class="entries">
              {meal.items.map((it, ii) => {
                const f = foods.get(it.foodId);
                const im = itemMacros(it, foods);
                return (
                  <li>
                    <button type="button" class="entry" onClick={() => itemSheet(p, wd, mi, ii)}>
                      <div class="grow">
                        <div class="entry-name">{f ? f.name : 'Missing food'}</div>
                        <div class="muted small">
                          {f ? quantityLabel(f, it.servings) : ''} {f?.group ? `· ${GROUP_LABEL[f.group]} ⇄` : ''}
                        </div>
                      </div>
                      <div class="entry-kcal">{im ? im.calories : '–'}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div class="row gap">
              <button type="button" class="btn btn-ghost btn-sm grow" onClick={() => addItemSheet(p, wd, mi)}>
                + Food
              </button>
              <button
                type="button"
                class="btn btn-secondary btn-sm grow"
                onClick={() => {
                  const logged = meal.items.map((it) => foods.get(it.foodId)).filter(Boolean).length;
                  meal.items.forEach((it) => {
                    const f = foods.get(it.foodId);
                    if (f) logFood(f, it.servings, app.today(), meal.mealType);
                  });
                  toast(`Logged ${logged} item${logged === 1 ? '' : 's'} to today’s ${MEAL_TYPE_LABEL[meal.mealType].toLowerCase()}`);
                }}
              >
                {isToday ? 'Log this meal' : 'Log to today'}
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function itemSheet(p: MealPlan, wd: Weekday, mi: number, ii: number) {
  const foods = foodMap();
  const day = p.days.find((d) => d.weekday === wd);
  const item = day?.meals[mi]?.items[ii];
  if (!item) return;
  const food = foods.get(item.foodId);
  let servings = item.servings;
  openSheet(food?.name ?? 'Food', (s) => {
    const subs = food ? substitutesFor(food, [...foods.values()]) : [];
    const setItem = (next: PlanItem | null) => {
      savePlan(updateMeal(p, wd, mi, (m) => ({ ...m, items: next ? m.items.map((x, i) => (i === ii ? next : x)) : m.items.filter((_, i) => i !== ii) })));
      s.close();
    };
    return (
      <div class="stack">
        <Field label="Servings">{Stepper({ value: servings, step: 0.25, min: 0.25, decimals: 2, onChange: (v) => (servings = v) })}</Field>
        <button type="button" class="btn btn-primary" onClick={() => setItem({ ...item, servings })}>
          Save servings
        </button>
        {subs.length && food ? (
          <div class="stack">
            <div class="list-heading">Swap for (keeps {food.group === 'protein' ? 'protein grams' : food.group === 'carb' ? 'carb grams' : food.group === 'milk' ? 'volume' : 'calories'} equal)</div>
            {subs.map((sub) => {
              const next = substitute(item, food, sub);
              const nm = foodMacros(sub, next.servings);
              const om = foodMacros(food, item.servings);
              return (
                <button type="button" class="list-btn" onClick={() => setItem(next)}>
                  <div class="grow">
                    <div>
                      {sub.name} · {quantityLabel(sub, next.servings)}
                    </div>
                    <div class="muted small">
                      {nm.calories} kcal ({nm.calories - om.calories >= 0 ? '+' : ''}
                      {nm.calories - om.calories}) · {fmt1(nm.protein)} P · {fmt1(nm.carbs)} C · {fmt1(nm.fat)} F
                    </div>
                  </div>
                  <span class="muted">⇄</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p class="muted small">No swap group set for this food. Set one in Food database to enable swaps.</p>
        )}
        <button type="button" class="btn btn-danger-ghost" onClick={() => setItem(null)}>
          Remove from plan
        </button>
      </div>
    );
  });
}

function addItemSheet(p: MealPlan, wd: Weekday, mi: number) {
  openSheet(
    'Add food to plan',
    (s) => {
      const foods = [...foodMap().values()].sort((a, b) => a.name.localeCompare(b.name));
      return (
        <div class="stack">
          {foods.map((f) => (
            <button
              type="button"
              class="list-btn"
              onClick={() => {
                savePlan(updateMeal(p, wd, mi, (m) => ({ ...m, items: [...m.items, { foodId: f.id, servings: 1 }] })));
                s.close();
              }}
            >
              <div class="grow">
                <div>{f.name}</div>
                <div class="muted small">
                  {quantityLabel(f, 1)} · {f.calories} kcal · {fmt1(f.protein)} P
                </div>
              </div>
              <span class="muted">+</span>
            </button>
          ))}
        </div>
      );
    },
    { tall: true },
  );
}
