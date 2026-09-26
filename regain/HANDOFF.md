# ReGain: build and run it locally

You need about 10 minutes. There's no hosting, no account, and nothing gets published.

---

## 1. What you need

| Tool | Check it | Get it |
|---|---|---|
| **Node.js 20 or newer** (22 recommended) | `node -v` | https://nodejs.org → the LTS installer |
| **Git** | `git --version` | Mac: `xcode-select --install` · Windows: https://git-scm.com |

## 2. Get the code

The code is on the branch `claude/regain-fitness-tracker-pwa-gf3cnl` of `harshilbahl/Code-1`:

```bash
git clone https://github.com/harshilbahl/Code-1.git
cd Code-1
git checkout claude/regain-fitness-tracker-pwa-gf3cnl
cd regain
```

## 3. Install, test, build, run

```bash
npm install          # installs only TypeScript + Node types (the app has no runtime deps)
npm test             # expect: "# pass 23" and "# fail 0"
npm run build        # expect: "Built ReGain <hash>: 43 files → dist/"
npm run serve        # expect: "ReGain on http://localhost:5173"
```

Open **http://localhost:5173** in a browser on the same computer. The Home screen should show BACK as today's workout, targets of 2,400 kcal and 130 g protein, and 60.0 kg.

Stop the server with `Ctrl + C`.

**While you're changing code**, run this instead of `build` and `serve`:
```bash
npm run dev          # rebuilds on every save; refresh the browser to see changes
```

## 4. Use it on your iPhone (same Wi-Fi, still private)

1. Keep `npm run serve` running on your computer.
2. Find your computer's local IP address:
   - Mac: `ipconfig getifaddr en0` (e.g. `192.168.1.23`)
   - Windows: `ipconfig`, then look for the "IPv4 Address" line
3. On the iPhone, open Safari and go to `http://192.168.1.23:5173` (use your own IP).
4. Optional: tap Share, then **Add to Home Screen**.

If the page won't load, allow Node through your computer's firewall. On a Mac, macOS asks the first time; click Allow.

**The limits of plain local Wi-Fi (HTTP):**
- ❌ **No offline mode.** Safari only runs service workers over HTTPS, so the app won't open when your computer is off or you're away from home Wi-Fi (at the gym, for example).
- ❌ Home Screen install may open as a Safari tab rather than full-screen. This is untested.
- ✅ Logging, charts, reports and on-phone storage all work.
- ⚠️ Data is saved **on the phone**, not on the computer. Export backups: More → Backup & data → Share / Save to Files.

**When you want offline mode at the gym**, the app needs HTTPS. The most private options, in order:
1. **Tailscale** (free): install it on your computer and phone, then run `tailscale serve 5173`. You get an HTTPS address only your own devices can reach, and nothing is public.
2. A Vercel deploy with **Deployment Protection** turned on, so it's behind a login. `regain/vercel.json` is already set up for this: Root Directory `regain`.

## 5. Optional: run the full end-to-end test

The e2e script needs Playwright. It's the only step that downloads a browser:
```bash
npm i -D playwright && npx playwright install chromium
npm run build && npm run e2e      # expect: "29/29 checks passed"
```
Screenshots are written to `regain/e2e-screens/`.

## 6. Where things are

```
regain/
  src/domain/     all calculations: nutrition, volume/PRs, weight trend, recovery,
                  weekly report, calorie-adjustment rules, meal parser, planner, seed data
  src/data/       storage (IndexedDB), backup/restore, Store
  src/ui/         screens and components (TSX → real DOM, no React)
  public/         index.html, styles.css, manifest, icons, service-worker template
  scripts/        build.mjs, serve.mjs, dev.mjs, e2e.mjs, make-icons.mjs
  tests/          unit tests (node:test)
  README.md       full feature list, definitions, rules, limitations
```

Common edits:

| I want to change… | Edit |
|---|---|
| Starting calorie/protein targets, split, profile | `src/domain/seed.ts` → `defaultSettings()` / `defaultProfile()`, or just use More → Targets & profile in the app |
| The preloaded Back workout | `src/domain/seed.ts` → `BACK_TEMPLATE` |
| Starter foods (values are labelled "est.") | `src/domain/seed.ts` → `SEED_FOODS` |
| Weekly adjustment rules (+150/+200, 0.75 kg/wk flag…) | `src/domain/adjustment.ts` → `ADJUSTMENT_RULES` |
| Under-recovery thresholds | `src/domain/recovery.ts` → `RECOVERY_RULES` |
| Colours / look | `public/styles.css` → the `:root` variables |

Seed data only applies on the **first launch** in a browser. To pick up new seed values, use More → Backup & data → Reset (after exporting), or open the app in a private window.

After any code change, run `npm run typecheck && npm test && npm run build`.

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `npm install` fails with 403 / network errors | Corporate VPN or proxy: try another network, or `npm config set registry https://registry.npmjs.org/` |
| Page shows the old version after a rebuild | Hard refresh (Cmd/Ctrl + Shift + R). If it persists: DevTools → Application → Service Workers → Unregister |
| iPhone can't reach `http://<ip>:5173` | Same Wi-Fi? Firewall allowing Node? Is `npm run serve` still running? Guest Wi-Fi networks often block device-to-device traffic |
| "ReGain couldn't start" | The error text is shown on screen. Private browsing on old iOS can block IndexedDB, in which case the app falls back to localStorage |
| Data disappeared on the iPhone | Safari and the Home Screen app have **separate** storage. Export from one and import into the other |

## 8. Known gaps (V1)

- Never tested on a real iPhone or in real Safari/WebKit. Tests ran in Chromium emulating an iPhone.
- No cloud sync. Data lives on one device, so export regularly.
- No barcode or online food search. The meal parser only matches foods already in your database.
- Metric units only.
- The repo's **existing** `ci` workflow (for the root Next.js app) fails because the root has no `package-lock.json`. This is unrelated to ReGain. ReGain has its own workflow: `.github/workflows/regain.yml`.
