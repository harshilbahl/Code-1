import { uid } from '../../data/store.js';
import { RuleBasedMealParser, type ParsedItem, matchScore } from '../../domain/mealParser.js';
import { MEAL_TYPE_LABEL, caloriesFromMacros, defaultMealType, foodMacros, quantityLabel, servingLabel } from '../../domain/nutrition.js';
import { MEAL_TYPES, type Food, type MealEntry, type MealType, type ServingUnit, type SubstitutionGroup } from '../../domain/types.js';
import { EstPill, Field, NumInput, Segmented, Stepper, fmt1, fmtInt } from '../components.js';
import { S, app } from '../context.js';
import { h, cls } from '../h.js';
import { confirmSheet, openSheet, toast, type SheetHandle } from '../overlay.js';

const parser = new RuleBasedMealParser();

export function logFood(food: Food, servings: number, date: string, mealType: MealType): MealEntry {
  const m = foodMacros(food, servings);
  const entry: MealEntry = {
    id: uid(),
    updatedAt: Date.now(),
    createdAt: Date.now(),
    date,
    mealType,
    foodId: food.id,
    name: food.name,
    servings,
    quantityLabel: quantityLabel(food, servings),
    estimated: food.source === 'reference',
    ...m,
  };
  S().put('foods', { ...food, useCount: food.useCount + 1, lastUsedAt: Date.now() }, true);
  return S().put('meals', entry);
}

function undoable(entries: MealEntry[]) {
  const label = entries.length === 1 ? `Logged ${entries[0].name} · ${entries[0].calories} kcal` : `Logged ${entries.length} items`;
  toast(label, {
    label: 'Undo',
    run: () => {
      entries.forEach((e) => S().remove('meals', e.id, true));
      S().emit();
    },
  });
}

function MealTypeChips(p: { value: MealType; onChange: (m: MealType) => void }): Node {
  return (
    <div class="chip-scroll">
      {Segmented({ options: MEAL_TYPES.map((m) => ({ value: m, label: MEAL_TYPE_LABEL[m] })), value: p.value, onChange: p.onChange, class: 'chips' })}
    </div>
  );
}

function foodLine(f: Food): string {
  return `${servingLabel(f)} · ${f.calories} kcal · ${fmt1(f.protein)} g P`;
}

/* ============================================================ Log meal (fast path) */

export function openLogMeal(opts: { date?: string; mealType?: MealType } = {}): void {
  const date = opts.date ?? app.today();
  let mealType: MealType = opts.mealType ?? defaultMealType();
  let query = '';

  openSheet(
    'Log food',
    (sheet) => {
      const list = (<div class="food-list" />) as HTMLElement;
      const search = (
        <input class="input search" type="search" placeholder="Search foods…" autocomplete="off" enterkeyhint="search" aria-label="Search foods" />
      ) as HTMLInputElement;

      const renderList = () => {
        const foods = S().all('foods');
        let rows: Food[];
        let heading: string;
        if (query.trim()) {
          rows = foods
            .map((f) => ({ f, s: matchScore(query, f) + (f.name.toLowerCase().includes(query.toLowerCase()) ? 0.5 : 0) }))
            .filter((x) => x.s > 0.2)
            .sort((a, b) => b.s - a.s)
            .slice(0, 30)
            .map((x) => x.f);
          heading = rows.length ? 'Results' : '';
        } else {
          const fav = foods.filter((f) => f.favorite).sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
          const recent = foods
            .filter((f) => !f.favorite && f.lastUsedAt)
            .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
            .slice(0, 12);
          rows = [...fav, ...recent];
          heading = 'Favorites & recent';
        }
        list.replaceChildren(
          heading ? <div class="list-heading">{heading}</div> : <div />,
          ...rows.map((f) => (
            <div class="food-row">
              <button type="button" class="food-row-main" onClick={() => openFoodDetail(sheet, f)}>
                <div class="food-name">
                  {f.favorite ? <span class="star">★</span> : null}
                  {f.name} {f.source === 'reference' ? EstPill() : null}
                </div>
                <div class="food-meta">{foodLine(f)}</div>
              </button>
              <button
                type="button"
                class="add-btn"
                aria-label={`Add 1 serving of ${f.name}`}
                onClick={() => {
                  const e = logFood(f, 1, date, mealType);
                  undoable([e]);
                }}
              >
                +
              </button>
            </div>
          )),
          !rows.length && query.trim() ? (
            <div class="empty small">
              <p class="muted">No food called “{query}”.</p>
              <button type="button" class="btn btn-secondary" onClick={() => openFoodEditor({ name: query }, (f) => openFoodDetail(sheet, f))}>
                Create “{query}”
              </button>
            </div>
          ) : (
            <div />
          ),
        );
      };

      const openFoodDetail = (s: SheetHandle, food: Food) => {
        let servings = 1;
        const preview = (<div class="macro-preview" />) as HTMLElement;
        const update = () => {
          const m = foodMacros(food, servings);
          preview.replaceChildren(
            <div class="mp">
              <b>{m.calories}</b>
              <span>kcal</span>
            </div>,
            <div class="mp">
              <b>{fmt1(m.protein)}</b>
              <span>protein</span>
            </div>,
            <div class="mp">
              <b>{fmt1(m.carbs)}</b>
              <span>carbs</span>
            </div>,
            <div class="mp">
              <b>{fmt1(m.fat)}</b>
              <span>fat</span>
            </div>,
          );
          qty.textContent = quantityLabel(food, servings);
        };
        const qty = (<span class="muted" />) as HTMLElement;
        s.setContent(
          <div class="stack">
            <button type="button" class="link-btn" onClick={() => s.setContent(main)}>
              ‹ Back to list
            </button>
            <div>
              <div class="food-name big">{food.name}</div>
              <div class="muted small">
                1 serving = {servingLabel(food)} {food.source === 'reference' ? '· typical reference value, check your label' : ''}
              </div>
            </div>
            <Field label="Servings" hint={qty}>
              {Stepper({ value: 1, step: 0.25, min: 0.25, decimals: 2, label: 'Servings', onChange: (v) => ((servings = v), update()) })}
            </Field>
            <div class="quick-servings row gap">
              {[0.5, 1, 1.5, 2, 3].map((n) => (
                <button
                  type="button"
                  class="chip"
                  onClick={(e: Event) => {
                    servings = n;
                    const inp = (e.currentTarget as HTMLElement).closest('.stack')?.querySelector('.stepper input') as HTMLInputElement | null;
                    if (inp) inp.value = String(n);
                    update();
                  }}
                >
                  {n}×
                </button>
              ))}
            </div>
            {preview}
            <MealTypeChips value={mealType} onChange={(m) => (mealType = m)} />
            <button
              type="button"
              class="btn btn-primary btn-lg"
              onClick={() => {
                if (!(servings > 0)) return toast('Servings must be above 0');
                const e = logFood(food, servings, date, mealType);
                undoable([e]);
                s.setContent(main);
                renderList();
              }}
            >
              Add to {MEAL_TYPE_LABEL[mealType].toLowerCase()}
            </button>
          </div>,
        );
        update();
      };

      search.addEventListener('input', () => {
        query = search.value;
        renderList();
      });

      const main = (
        <div class="stack">
          <MealTypeChips value={mealType} onChange={(m) => (mealType = m)} />
          {search}
          <div class="row gap">
            <button type="button" class="btn btn-secondary grow" onClick={() => openParse({ date, mealType })}>
              ✎ Type a meal
            </button>
            <button type="button" class="btn btn-secondary grow" onClick={() => openCustomEntry({ date, mealType })}>
              + Custom entry
            </button>
          </div>
          {list}
        </div>
      );
      renderList();
      return main;
    },
    { tall: true },
  );
}

/* ============================================================ Natural-language entry */

export function openParse(opts: { date: string; mealType: MealType; text?: string }): void {
  let mealType = opts.mealType;
  openSheet(
    'Type a meal',
    (sheet) => {
      const ta = (
        <textarea class="input textarea" rows="3" placeholder="e.g. 4 eggs, 3 rotis, 200g chicken, banana and peanut butter" aria-label="Meal description" />
      ) as HTMLTextAreaElement;
      ta.value = opts.text ?? '';
      const results = (<div class="stack" />) as HTMLElement;
      let items: (ParsedItem & { include: boolean })[] = [];

      const renderResults = () => {
        const foods = S().all('foods');
        if (!items.length) {
          results.replaceChildren();
          return;
        }
        const ready = items.filter((i) => i.include && i.match && i.servings && i.servings > 0);
        const total = ready.reduce((n, i) => n + foodMacros(i.match as Food, i.servings as number).calories, 0);
        const protein = ready.reduce((n, i) => n + foodMacros(i.match as Food, i.servings as number).protein, 0);
        results.replaceChildren(
          <p class="muted small">Matched against your food database. Nothing is logged until you confirm. Unmatched items are never guessed.</p>,
          ...items.map((it, idx) => {
            const select = (
              <select class="input select" aria-label={`Food for ${it.raw}`}>
                <option value="">— No match: choose a food —</option>
                {foods
                  .slice()
                  .sort((a, b) => matchScore(it.term, b) - matchScore(it.term, a) || a.name.localeCompare(b.name))
                  .map((f) => (
                    <option value={f.id} selected={it.match?.id === f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            ) as HTMLSelectElement;
            select.addEventListener('change', () => {
              const f = foods.find((x) => x.id === select.value) ?? null;
              items[idx] = { ...it, match: f, servings: f ? it.servings ?? 1 : null, confidence: f ? 'medium' : 'none', issues: f ? [] : it.issues };
              renderResults();
            });
            const m = it.match && it.servings ? foodMacros(it.match, it.servings) : null;
            return (
              <div class={cls('parse-item', !it.match && 'unmatched', it.match && !it.servings && 'needs')}>
                <div class="row between">
                  <div class="parse-raw">“{it.raw}”</div>
                  <label class="row gap small">
                    <input
                      type="checkbox"
                      checked={it.include}
                      onChange={(e: Event) => {
                        items[idx].include = (e.target as HTMLInputElement).checked;
                        renderResults();
                      }}
                    />
                    include
                  </label>
                </div>
                {select}
                {it.match ? (
                  <div class="row gap center">
                    <span class="muted small">Servings of {servingLabel(it.match)}</span>
                    {NumInput({
                      value: it.servings,
                      placeholder: '?',
                      label: 'Servings',
                      class: 'num-sm',
                      onInput: (v) => {
                        items[idx].servings = v;
                      },
                    })}
                    <button type="button" class="btn btn-ghost btn-sm" onClick={renderResults}>
                      Update
                    </button>
                  </div>
                ) : (
                  <button type="button" class="btn btn-ghost btn-sm" onClick={() => openFoodEditor({ name: it.term }, () => reparse())}>
                    + Create “{it.term}” with your own values
                  </button>
                )}
                {m ? (
                  <div class="small">
                    {m.calories} kcal · {fmt1(m.protein)} P · {fmt1(m.carbs)} C · {fmt1(m.fat)} F {it.match?.source === 'reference' ? EstPill() : null}
                  </div>
                ) : null}
                {it.issues.map((x) => (
                  <div class="warn small">⚠ {x}</div>
                ))}
              </div>
            );
          }),
          <MealTypeChips value={mealType} onChange={(m) => (mealType = m)} />,
          <button
            type="button"
            class="btn btn-primary btn-lg"
            disabled={!ready.length}
            onClick={() => {
              const logged = ready.map((i) => logFood(i.match as Food, i.servings as number, opts.date, mealType));
              undoable(logged);
              sheet.close();
            }}
          >
            Log {ready.length} item{ready.length === 1 ? '' : 's'} · {fmtInt(total)} kcal · {fmt1(protein)} g P
          </button>,
        );
      };

      const reparse = () => {
        items = parser.parse(ta.value, S().all('foods')).map((i) => ({ ...i, include: i.match !== null }));
        renderResults();
      };

      if (opts.text) setTimeout(reparse, 0);
      return (
        <div class="stack">
          {ta}
          <button type="button" class="btn btn-secondary" onClick={reparse}>
            Parse
          </button>
          {results}
        </div>
      );
    },
    { tall: true },
  );
}

/* ============================================================ Custom one-off entry */

export function openCustomEntry(opts: { date: string; mealType: MealType }): void {
  let mealType = opts.mealType;
  const v = { name: '', calories: null as number | null, protein: null as number | null, carbs: null as number | null, fat: null as number | null };
  let saveAsFood = false;
  let estimated = false;
  openSheet('Custom entry', (sheet) => (
    <div class="stack">
      <Field label="Name">
        <input class="input" placeholder="e.g. Chicken shawarma plate" onInput={(e: Event) => (v.name = (e.target as HTMLInputElement).value)} />
      </Field>
      <div class="grid2">
        <Field label="Calories (kcal)">{NumInput({ value: null, decimal: false, onInput: (n) => (v.calories = n) })}</Field>
        <Field label="Protein (g)">{NumInput({ value: null, onInput: (n) => (v.protein = n) })}</Field>
        <Field label="Carbs (g)">{NumInput({ value: null, onInput: (n) => (v.carbs = n) })}</Field>
        <Field label="Fat (g)">{NumInput({ value: null, onInput: (n) => (v.fat = n) })}</Field>
      </div>
      <label class="check-row">
        <input type="checkbox" onChange={(e: Event) => (estimated = (e.target as HTMLInputElement).checked)} /> These numbers are my estimate (label as est.)
      </label>
      <label class="check-row">
        <input type="checkbox" onChange={(e: Event) => (saveAsFood = (e.target as HTMLInputElement).checked)} /> Also save to my foods (1 serving)
      </label>
      <MealTypeChips value={mealType} onChange={(m) => (mealType = m)} />
      <button
        type="button"
        class="btn btn-primary btn-lg"
        onClick={() => {
          if (!v.name.trim()) return toast('Add a name');
          if (v.calories === null) return toast('Enter calories');
          const m = { calories: Math.round(v.calories), protein: v.protein ?? 0, carbs: v.carbs ?? 0, fat: v.fat ?? 0 };
          let foodId: string | null = null;
          if (saveAsFood) {
            const f = newFood({ name: v.name.trim(), ...m, source: estimated ? 'reference' : 'user' });
            S().put('foods', f, true);
            foodId = f.id;
          }
          const e = S().put('meals', {
            id: uid(),
            updatedAt: Date.now(),
            createdAt: Date.now(),
            date: opts.date,
            mealType,
            foodId,
            name: v.name.trim(),
            servings: 1,
            quantityLabel: '1 serving',
            estimated,
            ...m,
          });
          undoable([e]);
          sheet.close();
        }}
      >
        Log entry
      </button>
    </div>
  ));
}

/* ============================================================ Edit logged entry */

export function openEditMeal(entry: MealEntry): void {
  const food = entry.foodId ? S().get('foods', entry.foodId) : undefined;
  let mealType = entry.mealType;
  let servings = entry.servings;
  const manual = { calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat };
  let date = entry.date;

  openSheet('Edit entry', (sheet) => {
    const preview = (<div class="small muted" />) as HTMLElement;
    const upd = () => {
      if (food) {
        const m = foodMacros(food, servings);
        preview.textContent = `${quantityLabel(food, servings)} → ${m.calories} kcal · ${fmt1(m.protein)} P · ${fmt1(m.carbs)} C · ${fmt1(m.fat)} F`;
      }
    };
    const body = (
      <div class="stack">
        <div>
          <div class="food-name big">{entry.name}</div>
          {entry.estimated ? <div class="small muted">{EstPill()} values are reference/estimated</div> : null}
        </div>
        {food ? (
          <Field label="Servings" hint={preview}>
            {Stepper({ value: servings, step: 0.25, min: 0.25, decimals: 2, onChange: (v) => ((servings = v), upd()) })}
          </Field>
        ) : (
          <div class="grid2">
            <Field label="Calories">{NumInput({ value: manual.calories, decimal: false, onInput: (n) => (manual.calories = n ?? 0) })}</Field>
            <Field label="Protein (g)">{NumInput({ value: manual.protein, onInput: (n) => (manual.protein = n ?? 0) })}</Field>
            <Field label="Carbs (g)">{NumInput({ value: manual.carbs, onInput: (n) => (manual.carbs = n ?? 0) })}</Field>
            <Field label="Fat (g)">{NumInput({ value: manual.fat, onInput: (n) => (manual.fat = n ?? 0) })}</Field>
          </div>
        )}
        <Field label="Date">
          <input class="input" type="date" value={date} onChange={(e: Event) => (date = (e.target as HTMLInputElement).value || date)} />
        </Field>
        <MealTypeChips value={mealType} onChange={(m) => (mealType = m)} />
        <button
          type="button"
          class="btn btn-primary btn-lg"
          onClick={() => {
            const m = food ? foodMacros(food, servings) : { ...manual, calories: Math.round(manual.calories) };
            S().put('meals', { ...entry, mealType, date, servings, quantityLabel: food ? quantityLabel(food, servings) : entry.quantityLabel, ...m });
            toast('Entry updated');
            sheet.close();
          }}
        >
          Save
        </button>
        <button
          type="button"
          class="btn btn-danger-ghost"
          onClick={() => {
            S().remove('meals', entry.id);
            sheet.close();
            toast(`Deleted ${entry.name}`, { label: 'Undo', run: () => S().put('meals', entry) });
          }}
        >
          Delete entry
        </button>
      </div>
    );
    upd();
    return body;
  });
}

/* ============================================================ Food editor */

export function newFood(p: Partial<Food> & { name: string }): Food {
  return {
    id: uid(),
    updatedAt: Date.now(),
    aliases: [],
    servingAmount: 1,
    servingUnit: 'serving',
    gramsPerServing: null,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    source: 'user',
    favorite: false,
    group: null,
    dairyFree: true,
    lastUsedAt: null,
    useCount: 0,
    ...p,
  };
}

const UNITS: ServingUnit[] = ['g', 'ml', 'piece', 'slice', 'tbsp', 'tsp', 'cup', 'scoop', 'serving'];
const GROUPS: (SubstitutionGroup | '')[] = ['', 'protein', 'carb', 'milk', 'fat', 'fruit', 'other'];

export function openFoodEditor(initial: Partial<Food> & { name?: string }, onSaved?: (f: Food) => void): void {
  const existing = initial.id ? S().get('foods', initial.id) : undefined;
  const f: Food = existing ? { ...existing } : newFood({ name: initial.name ?? '', ...initial, id: uid() } as Food);
  openSheet(existing ? 'Edit food' : 'New food', (sheet) => {
    const check = (<div class="small" />) as HTMLElement;
    const recheck = () => {
      const implied = caloriesFromMacros(f);
      const diff = f.calories - implied;
      check.className = 'small ' + (Math.abs(diff) > Math.max(25, f.calories * 0.15) ? 'warn' : 'muted');
      check.textContent = `Macros imply ≈${implied} kcal (4/4/9)` + (Math.abs(diff) > Math.max(25, f.calories * 0.15) ? ' — check the numbers' : '');
    };
    const body = (
      <div class="stack">
        <Field label="Name">
          <input class="input" value={f.name} placeholder="Food name" onInput={(e: Event) => (f.name = (e.target as HTMLInputElement).value)} />
        </Field>
        <div class="grid2">
          <Field label="Serving size">{NumInput({ value: f.servingAmount, onInput: (n) => (f.servingAmount = n ?? 1) })}</Field>
          <Field label="Unit">
            <select class="input select" onChange={(e: Event) => (f.servingUnit = (e.target as HTMLSelectElement).value as ServingUnit)}>
              {UNITS.map((u) => (
                <option value={u} selected={u === f.servingUnit}>
                  {u}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Grams per serving (optional)" hint="Lets you log it by weight, e.g. “150g”.">
          {NumInput({ value: f.gramsPerServing, onInput: (n) => (f.gramsPerServing = n) })}
        </Field>
        <div class="grid2">
          <Field label="Calories">{NumInput({ value: f.calories, decimal: false, onInput: (n) => ((f.calories = n ?? 0), recheck()) })}</Field>
          <Field label="Protein (g)">{NumInput({ value: f.protein, onInput: (n) => ((f.protein = n ?? 0), recheck()) })}</Field>
          <Field label="Carbs (g)">{NumInput({ value: f.carbs, onInput: (n) => ((f.carbs = n ?? 0), recheck()) })}</Field>
          <Field label="Fat (g)">{NumInput({ value: f.fat, onInput: (n) => ((f.fat = n ?? 0), recheck()) })}</Field>
        </div>
        {check}
        <Field label="Where are these numbers from?">
          {Segmented({
            options: [
              { value: 'label', label: 'Pack label' },
              { value: 'user', label: 'My numbers' },
              { value: 'reference', label: 'Estimate' },
            ],
            value: f.source,
            onChange: (v) => (f.source = v as Food['source']),
          })}
        </Field>
        <Field label="Planner swap group (optional)">
          <select class="input select" onChange={(e: Event) => (f.group = ((e.target as HTMLSelectElement).value || null) as SubstitutionGroup | null)}>
            {GROUPS.map((g) => (
              <option value={g} selected={(f.group ?? '') === g}>
                {g || 'None'}
              </option>
            ))}
          </select>
        </Field>
        <label class="check-row">
          <input type="checkbox" checked={f.favorite} onChange={(e: Event) => (f.favorite = (e.target as HTMLInputElement).checked)} /> Favorite (shows first when logging)
        </label>
        <button
          type="button"
          class="btn btn-primary btn-lg"
          onClick={() => {
            if (!f.name.trim()) return toast('Add a name');
            if (!(f.servingAmount > 0)) return toast('Serving size must be above 0');
            const saved = S().put('foods', { ...f, name: f.name.trim() });
            sheet.close();
            toast(existing ? 'Food updated' : 'Food saved');
            onSaved?.(saved);
          }}
        >
          Save food
        </button>
        {existing ? (
          <button
            type="button"
            class="btn btn-danger-ghost"
            onClick={() =>
              confirmSheet({
                title: 'Delete food?',
                message: 'Logged meals keep their values. The food is removed from your database and meal plan swaps.',
                confirmLabel: 'Delete',
                danger: true,
                onConfirm: () => {
                  S().remove('foods', f.id);
                  sheet.close();
                },
              })
            }
          >
            Delete food
          </button>
        ) : null}
      </div>
    );
    recheck();
    return body;
  });
}
