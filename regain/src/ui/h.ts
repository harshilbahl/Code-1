/**
 * Minimal JSX → real DOM runtime (no virtual DOM). Screens are functions that return
 * fresh DOM; the app re-renders the active screen after committed data changes.
 * Inputs save silently while typing so focus is never lost mid-edit.
 */

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace JSX {
    type Element = Node;
    interface IntrinsicElements {
      [tag: string]: Record<string, unknown>;
    }
    interface ElementChildrenAttribute {
      children: unknown;
    }
  }
}

export type Child = Node | string | number | boolean | null | undefined | Child[];
type Props = Record<string, unknown> | null;
type Component = (props: Record<string, unknown> & { children?: Child[] }) => Node;

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'line', 'rect', 'circle', 'g', 'text', 'polyline', 'polygon', 'defs', 'linearGradient', 'stop', 'title', 'tspan', 'clipPath']);

export function h(tag: string | Component, props: Props, ...children: Child[]): Node {
  if (typeof tag === 'function') return tag({ ...(props ?? {}), children });
  const isSvg = SVG_TAGS.has(tag);
  const el = isSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'ref' && typeof v === 'function') {
        (v as (e: Element) => void)(el);
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === 'class' || k === 'className') {
        el.setAttribute('class', String(v));
      } else if (k === 'style' && typeof v === 'object') {
        Object.assign((el as HTMLElement).style, v);
      } else if (k === 'value' && !isSvg) {
        (el as HTMLInputElement).value = String(v);
      } else if (k === 'checked' || k === 'disabled' || k === 'selected') {
        (el as unknown as Record<string, unknown>)[k] = Boolean(v);
        if (v) el.setAttribute(k, '');
      } else if (k === 'html') {
        el.innerHTML = String(v);
      } else {
        el.setAttribute(k, v === true ? '' : String(v));
      }
    }
  }
  append(el, children);
  return el;
}

export function Fragment(props: { children?: Child[] }): Node {
  const f = document.createDocumentFragment();
  append(f, props.children ?? []);
  return f;
}

function append(parent: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false || c === true) continue;
    if (Array.isArray(c)) append(parent, c);
    else parent.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
