import { IndexedDBAdapter } from './data/indexeddb.js';
import { MemoryAdapter } from './data/memory.js';
import { Store } from './data/store.js';
import { app } from './ui/context.js';
import { h } from './ui/h.js';
import { closeAllSheets, closeTopSheet, toast } from './ui/overlay.js';
import { TABS, currentRoute, nav, navBack, type Tab } from './ui/router.js';
import { DashboardScreen } from './ui/screens/dashboard.js';
import { MealsScreen } from './ui/screens/meals.js';
import { BackupScreen, ChartsScreen, FoodsScreen, InstallScreen, MoreScreen, SettingsScreen } from './ui/screens/more.js';
import { PlannerScreen } from './ui/screens/planner.js';
import { RecoveryScreen } from './ui/screens/recovery.js';
import { ReportScreen } from './ui/screens/report.js';
import { WeightScreen } from './ui/screens/weight.js';
import { WorkoutDetailScreen, WorkoutListScreen } from './ui/screens/workout.js';

const TAB_META: Record<Tab, { label: string; icon: string }> = {
  dashboard: { label: 'Home', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  meals: { label: 'Meals', icon: 'M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 3c-2 2-3 4-3 7h3v11' },
  workout: { label: 'Workout', icon: 'M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12' },
  weight: { label: 'Weight', icon: 'M4 20h16l-2-12H6zM9 8a3 3 0 0 1 6 0M12 11l2 3' },
  report: { label: 'Report', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  more: { label: 'More', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
};

function screenFor(path: string[]): Node {
  const [root, sub] = path;
  switch (root) {
    case 'dashboard':
      return DashboardScreen();
    case 'meals':
      return MealsScreen();
    case 'workout':
      return sub ? WorkoutDetailScreen(sub) : WorkoutListScreen();
    case 'weight':
      return WeightScreen();
    case 'report':
      return ReportScreen();
    case 'more':
      switch (sub) {
        case 'recovery':
          return RecoveryScreen();
        case 'foods':
          return FoodsScreen();
        case 'planner':
          return PlannerScreen();
        case 'charts':
          return ChartsScreen();
        case 'settings':
          return SettingsScreen();
        case 'backup':
          return BackupScreen();
        case 'install':
          return InstallScreen();
        default:
          return MoreScreen();
      }
    default:
      return DashboardScreen();
  }
}

const main = document.getElementById('main') as HTMLElement;
const tabbar = document.getElementById('tabbar') as HTMLElement;
let lastRouteKey = '';
let renderQueued = false;

function renderTabs(active: string) {
  tabbar.replaceChildren(
    ...TABS.map((t) => (
      <button
        type="button"
        class={'tab' + (t === active ? ' active' : '')}
        aria-label={TAB_META[t].label}
        aria-current={t === active ? 'page' : undefined}
        onClick={() => {
          closeAllSheets();
          if (currentRoute().path[0] === t && currentRoute().path.length === 1) window.scrollTo({ top: 0, behavior: 'smooth' });
          else nav(t);
        }}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d={TAB_META[t].icon} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{TAB_META[t].label}</span>
      </button>
    )),
  );
}

function render() {
  renderQueued = false;
  const route = currentRoute();
  const key = route.path.join('/') + '?' + route.query.toString();
  const sameRoute = key === lastRouteKey;
  const scroll = window.scrollY;
  let view: Node;
  try {
    view = screenFor(route.path);
  } catch (e) {
    console.error(e);
    view = (
      <div class="screen">
        <div class="empty">
          <div class="empty-title">Something went wrong on this screen</div>
          <p class="muted small">{String((e as Error)?.message ?? e)}</p>
          <button type="button" class="btn btn-secondary" onClick={() => nav('dashboard', { replace: true })}>
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }
  main.replaceChildren(view);
  if (!sameRoute) main.classList.remove('enter'), void main.offsetWidth, main.classList.add('enter');
  renderTabs(route.path[0]);
  window.scrollTo(0, sameRoute ? scroll : 0);
  lastRouteKey = key;
}

export function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(render);
}

/* Edge-swipe back (iOS standalone apps have no browser back gesture). */
function installSwipeBack() {
  let sx = 0;
  let sy = 0;
  let tracking = false;
  document.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      tracking = t.clientX < 24 && currentRoute().path.length > 1;
      sx = t.clientX;
      sy = t.clientY;
    },
    { passive: true },
  );
  document.addEventListener(
    'touchend',
    (e) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (t.clientX - sx > 80 && Math.abs(t.clientY - sy) < 60) {
        if (!closeTopSheet()) navBack();
      }
    },
    { passive: true },
  );
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  // Reload only when an updated worker takes over — not on the first-install claim, which would
  // reload the page moments after first paint (dropping an open sheet or a running rest timer).
  const hadController = !!navigator.serviceWorker.controller;
  let wantReload = false;
  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      const prompt = (w: ServiceWorker) =>
        toast('A new version of ReGain is ready', { label: 'Reload', run: () => ((wantReload = true), w.postMessage('skipWaiting')) }, 15000);
      if (reg.waiting && navigator.serviceWorker.controller) prompt(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) prompt(w);
        });
      });
      // check for updates when the app comes back to the foreground
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => undefined));
    })
    .catch((e) => console.warn('SW registration failed', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if ((!hadController && !wantReload) || reloading) return;
    reloading = true;
    location.reload();
  });
}

async function boot() {
  let adapter: IndexedDBAdapter | MemoryAdapter;
  let store: Store;
  try {
    if (!IndexedDBAdapter.available()) throw new Error('IndexedDB unavailable');
    adapter = new IndexedDBAdapter();
    store = new Store(adapter);
    await store.load();
  } catch (e) {
    console.warn('Falling back to localStorage', e);
    adapter = new MemoryAdapter(window.localStorage);
    store = new Store(adapter);
    await store.load();
  }
  app.store = store;
  app.storageKind = adapter.kind;
  store.onError = (err) => {
    console.error(err);
    toast('⚠ Could not save to device storage. Export a backup.', undefined, 8000);
  };
  await store.seedIfEmpty();

  try {
    app.persistent = (await navigator.storage?.persist?.()) ?? null;
  } catch {
    app.persistent = null;
  }

  store.subscribe(scheduleRender);
  window.addEventListener('routechange', () => {
    closeAllSheets();
    scheduleRender();
  });
  window.addEventListener('popstate', () => {
    closeAllSheets();
    scheduleRender();
  });
  // Day rollover while the app stays open (common for an installed PWA).
  let day = app.today();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && app.today() !== day) {
      day = app.today();
      scheduleRender();
    }
  });
  installSwipeBack();
  render();
  document.body.classList.add('ready');
  registerServiceWorker();
}

boot().catch((e) => {
  console.error(e);
  main.replaceChildren(
    <div class="screen">
      <div class="empty">
        <div class="empty-title">ReGain couldn’t start</div>
        <p class="muted small">{String((e as Error)?.message ?? e)}</p>
        <button type="button" class="btn btn-secondary" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    </div>,
  );
});
