import { addDays, formatDay } from '../../domain/dates.js';
import { MEAL_TYPE_LABEL, dayTotals, mealsOn, sumMacros } from '../../domain/nutrition.js';
import { MEAL_TYPES, type MealType } from '../../domain/types.js';
import { uid } from '../../data/store.js';
import { Card, EstPill, Header, Progress, fmt1, fmtInt } from '../components.js';
import { S, app } from '../context.js';
import { h } from '../h.js';
import { toast } from '../overlay.js';
import { currentRoute, nav } from '../router.js';
import { openEditMeal, openLogMeal, openParse } from './mealSheets.js';

export function MealsScreen(): Node {
  const store = S();
  const today = app.today();
  const date = currentRoute().query.get('date') ?? today;
  const settings = store.settings;
  const meals = mealsOn(store.all('meals'), date).sort((a, b) => a.createdAt - b.createdAt);
  const totals = dayTotals(store.all('meals'), date);
  const go = (d: string) => nav(`meals?date=${d}`, { replace: true });

  const copyFromYesterday = (type: MealType) => {
    const src = mealsOn(store.all('meals'), addDays(date, -1)).filter((m) => m.mealType === type);
    if (!src.length) return toast(`No ${MEAL_TYPE_LABEL[type].toLowerCase()} logged the day before`);
    const copies = src.map((m) => ({ ...m, id: uid(), date, createdAt: Date.now() }));
    store.putMany('meals', copies);
    toast(`Copied ${copies.length} item${copies.length === 1 ? '' : 's'}`, {
      label: 'Undo',
      run: () => {
        copies.forEach((c) => store.remove('meals', c.id, true));
        store.emit();
      },
    });
  };

  return (
    <div class="screen">
      <Header title="Meals" subtitle={formatDay(date, today)} action={<button type="button" class="btn btn-primary btn-sm" onClick={() => openLogMeal({ date })}>+ Log</button>} />

      <div class="date-nav">
        <button type="button" class="icon-btn" aria-label="Previous day" onClick={() => go(addDays(date, -1))}>
          ‹
        </button>
        <input class="date-input" type="date" value={date} aria-label="Date" onChange={(e: Event) => go((e.target as HTMLInputElement).value || today)} />
        <button type="button" class="icon-btn" aria-label="Next day" disabled={date >= today} onClick={() => go(addDays(date, 1))}>
          ›
        </button>
      </div>

      <Card class="totals-card">
        <div class="grid2 tight">
          <div>
            <div class="muted small">Calories</div>
            <div class="num-xl">{fmtInt(totals.calories)}</div>
            <div class="muted small">of {fmtInt(settings.calorieTarget)} kcal</div>
            <Progress value={totals.calories} max={settings.calorieTarget} />
          </div>
          <div>
            <div class="muted small">Protein</div>
            <div class="num-xl">{fmt1(totals.protein)}</div>
            <div class="muted small">of {settings.proteinTarget} g</div>
            <Progress value={totals.protein} max={settings.proteinTarget} tone="protein" />
          </div>
        </div>
        <div class="macro-chips">
          <span>
            <i class="dot dot-carbs" /> Carbs <b>{fmtInt(totals.carbs)} g</b>
          </span>
          <span>
            <i class="dot dot-fat" /> Fat <b>{fmtInt(totals.fat)} g</b>
          </span>
          <span class="muted">{meals.length} items</span>
        </div>
      </Card>

      <button type="button" class="nl-entry" onClick={() => openParse({ date, mealType: 'lunch' })}>
        <span>✎</span>
        <span class="muted">Type a meal: “4 eggs, 3 rotis, 200g chicken…”</span>
      </button>

      {MEAL_TYPES.map((type) => {
        const items = meals.filter((m) => m.mealType === type);
        const sub = sumMacros(items);
        return (
          <Card
            class="meal-group"
            title={
              <span>
                {MEAL_TYPE_LABEL[type]} {items.length ? <span class="muted small">· {sub.calories} kcal · {fmt1(sub.protein)} g P</span> : null}
              </span>
            }
            action={
              <button type="button" class="icon-btn add-sm" aria-label={`Add to ${MEAL_TYPE_LABEL[type]}`} onClick={() => openLogMeal({ date, mealType: type })}>
                +
              </button>
            }
          >
            {items.length ? (
              <ul class="entries">
                {items.map((m) => (
                  <li>
                    <button type="button" class="entry" onClick={() => openEditMeal(m)}>
                      <div class="grow">
                        <div class="entry-name">
                          {m.name} {m.estimated ? EstPill() : null}
                        </div>
                        <div class="muted small">
                          {m.quantityLabel} · {fmt1(m.protein)} P · {fmt1(m.carbs)} C · {fmt1(m.fat)} F
                        </div>
                      </div>
                      <div class="entry-kcal">{m.calories}</div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <button type="button" class="link-btn small" onClick={() => copyFromYesterday(type)}>
                Copy from previous day
              </button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
