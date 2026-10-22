# ReGain

ReGain is a mobile-first tracker for fitness, nutrition and weight regain. It's an installable **Progressive Web App** (PWA): you can add it to the iPhone Home Screen, and it works offline, stores data on the device, and backs up to JSON.

It's a real web app served over HTTPS. It isn't a single HTML file, so it doesn't depend on an in-app file preview.

---

## What's in V1 (milestone 1)

| Area | What works |
|---|---|
| **Dashboard** | Latest weight, 7-day average and trend (↗ → ↘). Calories, protein, carbs and fat against targets, with progress bars. Today's workout with a completion ring. Sleep, energy and soreness, plus an under-recovery alert. Quick actions: Log meal, Log weight, Start workout, Recovery. A banner when last week's report is ready. |
| **Meals** | Add, edit and delete entries across six meal types. Daily totals. Date navigation. "Copy from previous day" per meal. Favorites and recent foods, with **one-tap "+" logging** and Undo. A servings stepper. Custom one-off entries. |
| **Natural-language entry** | Type `4 eggs, 3 rotis, 200g chicken, banana and peanut butter`. The text is split into items, each matched against *your* food database and shown for confirmation. **Nothing is invented:** an item with no match is flagged and never guessed, and ambiguous units (like "2 chicken") ask you to set servings. |
| **Food database** | 30 dairy-free starter foods, labelled **est.** because they're typical reference values. You can add your own foods (serving, grams per serving, kcal and macros, source), mark favorites, and set swap groups. The editor also warns when the kcal figure doesn't match 4/4/9 × the macros. |
| **Workout** | Today's BACK — Width + Thickness session is preloaded, with all 8 exercises (Shrugs marked optional), rep ranges, RIR 1–2 and rests of 2–3 min for compounds and 60–90 s for isolation work. Each set records weight, reps, RIR and notes. The previous session's numbers are pre-filled, so **logging a set is one tap on ✓**. After a set, a rest timer starts automatically. You can swap exercises (with suggested alternatives), edit sets, reps, rest and RIR, reorder, add or remove exercises, and save as a template. Other ways to start: repeat a past session, or start an empty workout. |
| **Workout maths** | Total sets, total reps and volume. PRs: heaviest load, estimated 1RM (Epley, labelled as an estimate) and best set volume. Previous-vs-current comparison for each exercise, and a session summary. |
| **Body weight** | One entry per day, with an optional note. Shows the latest weight, 7-day average, trend, weekly averages for the last 8 weeks, change from the previous week and change from the start. Chart ranges: 7, 30 or 90 days. |
| **Recovery** | Sleep hours, plus 1–5 ratings for sleep quality, energy, soreness and stress. Steps and water are optional. Rules flag a day as under-recovered, and a consistent pattern raises an alert on the dashboard. |
| **Weekly report** | Covers any week: body weight (starting and ending weekly averages, change, trend), nutrition averages, days the calorie and protein targets were reached, training (days, sets, volume, muscle groups, rest days) and recovery averages. Observations are data-based sentences, followed by a **proposed adjustment you approve or decline**. |
| **Targets** | Calories, protein, and optional carbs and fat are all editable. You can also set goal, activity level and split. A Mifflin-St Jeor estimate is shown, labelled as an estimate. Every target change is recorded in a history. |
| **Diet planner** | A 7-day, dairy-free, high-protein plan with easy meals. Swaps keep the macro that matters equal: chicken ↔ fish ↔ eggs ↔ tofu keeps protein, rice ↔ roti ↔ potatoes keeps carbs, and soy ↔ oat ↔ almond milk keeps volume. "Fit to calorie target" scales carbs and fats. "Log this meal" logs a planned meal in one tap. |
| **Charts** | Weight (daily points plus the 7-day average) over 7, 30 or 90 days. Calories and protein against target. Weekly training volume. Tap a chart to read exact values. |
| **Data** | Stored in IndexedDB, with localStorage as a fallback. Export to JSON (via the share sheet or Save to Files, or as a download). Import is validated before anything is replaced. Reset requires typing `RESET`. |
| **PWA** | Manifest, service worker with a precached app shell (works offline), PNG icons including `apple-touch-icon`, iOS standalone meta tags, safe-area insets, an update prompt, and edge-swipe back. |

### Definitions used

- **Volume**: `weight × reps` for completed sets only.
  - **Unilateral** exercises (e.g. Single-Arm Lat Pulldown): reps are logged **per side**, and volume counts both sides: `weight × reps × 2`.
  - **Bodyweight** exercises (Weighted Pull-up, Dips): load = **body weight + added weight**. Body weight is your latest weigh-in and is frozen onto the workout when you finish it.
- **7-day average**: the mean of weigh-ins in the last 7 days. It needs at least 3 weigh-ins, otherwise nothing is shown.
- **Trend**: this 7-day average compared with the previous 7-day average. A change under 0.1 kg is "flat". A single day's weight never drives a decision.
- **Nutrition averages** only count days that have food logged. Days with nothing logged are excluded, not counted as zero.
- **Target reached**: logged intake ≥ 95% of that day's target. The threshold is editable.
- **Under-recovered day**: any of sleep < 7 h, sleep quality ≤ 2, energy ≤ 2, soreness ≥ 4 or stress ≥ 4. The pattern is "consistent" when at least 3 flagged days make up at least half of the logged days in the last 7.
- **Weekly adjustment rules** (`src/domain/adjustment.ts`). Every one is a *proposal*; nothing changes without your approval:
  - Not enough weigh-ins (< 3 per week) or food logs (< 4 days): no proposal.
  - Gaining faster than 0.75 kg/week: **flagged for review**, with no automatic change (regain after a deficit often includes water and glycogen).
  - Average intake below 90% of target: work on hitting the current target first; the target isn't raised.
  - Flat for 2 weeks in a row with good adherence: +150–250 kcal (proposes +200).
  - Flat for 1 week: +150, labelled low confidence.
  - Rising 0.1–0.75 kg/week: hold.

The starting target of 2,400 kcal is an **editable starting estimate**, not a medical requirement. The weekly trend is what refines it.

---

## Why this stack (and not React + Vite)

The brief preferred React + TypeScript + Vite. This build environment's network policy **blocks the npm registry**; only TypeScript was available from a local cache. Rather than stop, V1 uses:

- **TypeScript** (strict), compiled by `tsc` to native ES modules. There's no bundler.
- A **~75-line JSX-to-DOM runtime** (`src/ui/h.ts`). Screens are written in TSX and render real DOM nodes.
- **Zero runtime dependencies.**

For reliability, the #1 priority in the brief, this is a reasonable trade: nothing needs upgrading, the whole app loads in ~40 small cached files, and it runs on iOS 14+.

The architecture is split so that a move to React later only touches `src/ui`:

```
src/domain/   pure business logic — no DOM, no storage (unit-tested in Node)
src/data/     StorageAdapter interface + IndexedDB / memory implementations, Store, backup
src/ui/       screens and components (the only layer that touches the DOM)
```

---

## Setup

Requires Node 20 or newer (22 recommended).

```bash
cd regain
npm install          # only dev dependencies: typescript, @types/node
npm run dev          # build + watch + serve on http://localhost:5173 (reload to see changes)
```

Other scripts:

```bash
npm run build        # typecheck + compile to dist/ + generate sw.js (content-hashed version)
npm run serve        # serve dist/ on :5173
npm run typecheck
npm test             # 23 unit tests (domain + store + backup) via node:test
npm run e2e          # 29 end-to-end checks in mobile-emulated Chromium (needs Playwright)
npm run icons        # re-render PNG icons from public/icons/icon.svg (needs Playwright)
```

To open the local build on your iPhone over Wi-Fi, run `npm run serve` and browse to `http://<your-computer-ip>:5173`. Service workers, and so offline mode and install, **need HTTPS** except on `localhost`. For a real install test, deploy it (below).

---

## Deployment (static hosting, HTTPS)

`npm run build` produces a fully static `dist/` folder. Any HTTPS static host works. All paths are relative, so a sub-path such as GitHub Pages also works.

**Vercel (recommended; `vercel.json` included)**
1. Import the repo on vercel.com.
2. Set **Root Directory** to `regain`. `vercel.json` sets the build to `npm run build` and the output to `dist`.
3. Deploy. You get an HTTPS URL such as `https://regain-xxx.vercel.app`.

Or from the CLI: `cd regain && npx vercel --prod`.

**Netlify / Cloudflare Pages**
Base directory `regain`, build command `npm run build`, publish directory `dist`. `dist/_headers` sets the cache headers.

**GitHub Pages**
Build, then publish the contents of `regain/dist` to a `gh-pages` branch.

Cache headers: HTML, JS and CSS are served `no-cache`, so revalidation stays cheap, and `sw.js` is `no-store`. When a new build is live, an open app shows **"A new version of ReGain is ready → Reload"**.

---

## Install on iPhone

1. Open the deployed URL in **Safari**. Not Chrome, not an in-app browser, not a file preview.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Launch ReGain from the Home Screen. It runs full-screen, has its own icon, and works offline.
4. Inside the app, **More → Install on iPhone** repeats these steps and confirms when it's running installed.

> On iOS, the installed app and Safari have **separate storage**. If you logged data in Safari first, go to More → Backup → Share / Save to Files, then import that file in the installed app.

---

## Backups

More → Backup & data:
- **Share / Save to Files** uses the iOS share sheet to save a `.json` file to Files, AirDrop or Mail.
- **Download JSON** works on desktop browsers.
- **Import** checks the file (app id, schema version and the shape of each collection) and shows counts before it **replaces** the data on the device.
- **Reset** requires typing RESET, then restores the starter data.

The backup format is `{ app: "regain", schemaVersion: 1, exportedAt, data: { userProfile, settings, foods, meals, exercises, workouts, workoutSets, workoutTemplates, bodyWeight, recovery, weeklyReports, mealPlans } }`.

---

## Test summary (this build)

**Unit tests (`npm test`): 23/23 passing.** They cover:
- macro sums, day totals and quantity labels
- volume, including the unilateral ×2 and bodyweight + added rules; the T-Bar example from the brief (80×8, 80×8, 75×10, 70×12 = 2,870 kg); previous-session lookup; PRs, including that no PR is claimed on a first session
- 7-day averages (3 weigh-ins minimum) and the week-over-week trend
- the under-recovery rule
- every adjustment branch: two flat weeks, one flat week, fast gain → review, low adherence, insufficient data, on-track hold
- the weekly report (averages over logged days, hit counts, observations)
- the natural-language parser, including that an unknown food isn't guessed and an ambiguous unit is flagged
- planner swaps (iso-protein and iso-carb) and fit-to-target
- store seeding, persistence across reload, the export → import round trip, rejection of invalid files, and reset

**End-to-end (`npm run e2e`): 29/29 passing.** These run in Chromium emulating a 390×844 iPhone with touch:
1. Dashboard shows the preloaded BACK workout, 2,400 kcal and 130 g targets, and 60.0 kg.
2. Log meal quick action → one-tap Egg.
3. Natural-language entry (`4 eggs, 200g chicken, dragonfruit`) → 2 matched, 1 flagged, logged 618 kcal / 87.2 g protein.
4. Totals = 690 kcal / 93.5 g protein.
5. Editing 4 → 2 eggs updates the totals.
6. Deleting an entry updates the totals.
7. Custom entry works.
8. Weight 60.4 kg is logged.
9. Starting the workout and logging T-Bar 80×8 gives 640 kg volume, and the rest timer starts.
10. The next set pre-fills and logs with one tap (1,280).
11. Weighted pull-up volume = (60.4 + 10) × 8.
12. Unilateral volume counts ×2.
13. The swap sheet suggests alternatives.
14. Finishing the workout shows the summary, and the dashboard shows "Done".
15. A repeated workout shows the previous session and pre-filled placeholders.
16. Recovery can be logged.
17. The weekly report renders with observations and a proposal.
18. A planner swap keeps protein.
19. The charts render.
20. A settings change shows on the dashboard.
21. **Data persists after reload.**
22. **Export** produces valid JSON.
23. **Reset** is gated behind typing RESET.
24. **Import** restores the data.
25. The **service worker installs and the app loads with the network offline.**
26. The manifest and icons resolve.
27. No horizontal overflow on any tab at 390 px or 320 px.
28. Desktop at 1280 px renders.
29. **Zero console or JavaScript errors.**

---

## Known limitations

- **Not yet tested on a physical iPhone or in real Safari/WebKit.** The e2e run uses Chromium with iPhone emulation, because WebKit couldn't be downloaded in the build environment. The code sticks to APIs iOS Safari 14+ supports (IndexedDB, ES modules, service workers, `navigator.share` with files). Even so, do a 5-minute pass on the device after deploying: install, log a meal, log a set, close the app fully, reopen, and check airplane mode.
- **iOS storage eviction:** Safari can clear data for sites that go unused for weeks. Installing to the Home Screen reduces this, and the app asks for persistent storage. **Export regularly** until cloud sync exists.
- Food values in the starter database are **typical reference values** and are labelled **est.**; edit them to match your labels. There's no barcode scanning or online food search yet.
- The natural-language parser is rule-based and only matches foods already in your database (Phase 2: AI parsing, see below).
- The rest timer has no sound or vibration on iOS, because Safari doesn't support `navigator.vibrate`.
- Everything is metric only (kg, g, ml).
- Single device only; there's no sync yet.
- Weekly adjustment rules are simple heuristics, not medical or nutritional advice. You approve every change.

---

## Phase 2 roadmap and extension points

- **AI meal parsing:** implement the `MealParser` interface (`src/domain/mealParser.ts`) with an LLM call behind a small serverless function, so the API key never ships to the client. It returns the same `ParsedItem[]` with `estimated` flags. The confirmation UI already exists.
- **Automated diet adjustment:** `proposeAdjustment()` is pure and already covered by tests. It could also suggest protein or macro splits, but approval stays mandatory.
- **Cloud sync:** add a `StorageAdapter` for a backend (Supabase, Firebase, or a REST API with auth). Every record already has a stable string `id` and `updatedAt`, so last-write-wins per record is simple; for deletes, add tombstones. The `Store` only talks to the adapter interface.
- **React migration (optional):** the domain and data layers carry over unchanged; only `src/ui` gets rewritten.
