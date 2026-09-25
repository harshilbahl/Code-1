/** Hash router: works on any static host (no server rewrites) and inside an installed PWA. */

export interface Route {
  path: string[]; // e.g. ['workout', '<id>']
  query: URLSearchParams;
}

export function currentRoute(): Route {
  const raw = location.hash.replace(/^#\/?/, '');
  const [p, q] = raw.split('?');
  const path = p.split('/').filter(Boolean);
  return { path: path.length ? path : ['dashboard'], query: new URLSearchParams(q ?? '') };
}

let inAppDepth = 0;
window.addEventListener('popstate', () => {
  inAppDepth = Math.max(0, inAppDepth - 1);
});

export function nav(to: string, opts: { replace?: boolean } = {}): void {
  const hash = '#/' + to.replace(/^#?\/?/, '');
  if (opts.replace) history.replaceState(null, '', hash);
  else {
    history.pushState(null, '', hash);
    inAppDepth++;
  }
  window.dispatchEvent(new Event('routechange'));
}

/** Back within the app; if the page was opened directly (no in-app history), go to the section root. */
export function navBack(): void {
  if (inAppDepth > 0) {
    history.back();
    return;
  }
  const r = currentRoute();
  nav(r.path.length > 1 ? r.path[0] : 'dashboard', { replace: true });
}

export const TABS = ['dashboard', 'meals', 'workout', 'weight', 'report', 'more'] as const;
export type Tab = (typeof TABS)[number];
