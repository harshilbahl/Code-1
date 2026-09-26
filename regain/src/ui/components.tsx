import { h, cls, type Child } from './h.js';
import { navBack } from './router.js';

export const fmtInt = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(n) ? '–' : Math.round(n).toLocaleString());
export const fmt1 = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(n) ? '–' : (Math.round(n * 10) / 10).toString());
export const fmtKg = (n: number | null | undefined, digits = 1) => (n === null || n === undefined ? '–' : n.toFixed(digits));
export const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(digits)}`;

export function Header(p: { title: string; subtitle?: Child; back?: boolean; action?: Child }): Node {
  return (
    <header class="screen-head">
      {p.back ? (
        <button class="icon-btn back-btn" type="button" aria-label="Back" onClick={() => navBack()}>
          ‹
        </button>
      ) : null}
      <div class="grow">
        <h1>{p.title}</h1>
        {p.subtitle ? <div class="subtitle">{p.subtitle}</div> : null}
      </div>
      {p.action ?? null}
    </header>
  );
}

export function Card(p: { title?: Child; action?: Child; class?: string; children?: Child; onClick?: () => void }): Node {
  return (
    <section class={cls('card', p.class, p.onClick && 'tappable')} onClick={p.onClick}>
      {p.title || p.action ? (
        <div class="card-head">
          <h3>{p.title}</h3>
          {p.action ?? null}
        </div>
      ) : null}
      {p.children}
    </section>
  );
}

export function Progress(p: { value: number; max: number; tone?: 'accent' | 'protein' | 'carbs' | 'fat' | 'muted'; label?: string }): Node {
  const pct = p.max > 0 ? Math.min(100, (p.value / p.max) * 100) : 0;
  const over = p.max > 0 && p.value > p.max * 1.1;
  return (
    <div class="progress" role="progressbar" aria-valuenow={Math.round(p.value)} aria-valuemax={Math.round(p.max)} aria-label={p.label}>
      <div class={cls('progress-fill', `tone-${p.tone ?? 'accent'}`, over && 'over')} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring(p: { value: number; size?: number; stroke?: number; label?: Child }): Node {
  const size = p.size ?? 64;
  const stroke = p.stroke ?? 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, p.value));
  return (
    <div class="ring" style={{ width: `${size}px`, height: `${size}px` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" stroke-width={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          stroke-width={stroke}
          stroke-linecap="round"
          stroke-dasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div class="ring-label">{p.label ?? `${Math.round(v * 100)}%`}</div>
    </div>
  );
}

export function Stat(p: { label: Child; value: Child; unit?: string; sub?: Child; class?: string }): Node {
  return (
    <div class={cls('stat', p.class)}>
      <div class="stat-label">{p.label}</div>
      <div class="stat-value">
        {p.value}
        {p.unit ? <span class="unit">{p.unit}</span> : null}
      </div>
      {p.sub ? <div class="stat-sub">{p.sub}</div> : null}
    </div>
  );
}

export function Empty(p: { title: string; body?: Child; action?: Child }): Node {
  return (
    <div class="empty">
      <div class="empty-title">{p.title}</div>
      {p.body ? <p class="muted">{p.body}</p> : null}
      {p.action ?? null}
    </div>
  );
}

export function Field(p: { label: Child; hint?: Child; children?: Child }): Node {
  return (
    <label class="field">
      <span class="field-label">{p.label}</span>
      {p.children}
      {p.hint ? <span class="field-hint">{p.hint}</span> : null}
    </label>
  );
}

/** Numeric input tuned for iPhone: decimal keypad, 16px+ font (no zoom), select-on-focus. */
export function NumInput(p: {
  value: number | null | undefined;
  placeholder?: string;
  decimal?: boolean;
  onInput?: (v: number | null) => void;
  class?: string;
  label?: string;
  min?: number;
  ref?: (el: HTMLInputElement) => void;
}): Node {
  const el = (
    <input
      class={cls('input num', p.class)}
      type="text"
      inputmode={p.decimal === false ? 'numeric' : 'decimal'}
      pattern={p.decimal === false ? '[0-9]*' : undefined}
      autocomplete="off"
      enterkeyhint="done"
      aria-label={p.label}
      placeholder={p.placeholder ?? ''}
      value={p.value === null || p.value === undefined ? '' : String(p.value)}
    />
  ) as HTMLInputElement;
  el.addEventListener('focus', () => setTimeout(() => el.select(), 0));
  el.addEventListener('input', () => p.onInput?.(parseNum(el.value)));
  p.ref?.(el);
  return el;
}

export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function Stepper(p: { value: number; step: number; min?: number; max?: number; decimals?: number; onChange: (v: number) => void; label?: string; suffix?: string }): Node {
  let v = p.value;
  const d = p.decimals ?? (p.step < 1 ? 2 : 0);
  const input = NumInput({
    value: +v.toFixed(d),
    label: p.label,
    onInput: (n) => {
      if (n === null) return;
      v = n;
      p.onChange(v);
    },
  }) as HTMLInputElement;
  const bump = (dir: number) => {
    v = +(Math.max(p.min ?? 0, Math.min(p.max ?? Infinity, v + dir * p.step))).toFixed(d);
    input.value = String(v);
    p.onChange(v);
  };
  return (
    <div class="stepper">
      <button type="button" class="step-btn" aria-label="Decrease" onClick={() => bump(-1)}>
        −
      </button>
      {input}
      {p.suffix ? <span class="stepper-suffix">{p.suffix}</span> : null}
      <button type="button" class="step-btn" aria-label="Increase" onClick={() => bump(1)}>
        +
      </button>
    </div>
  );
}

export function Segmented<T extends string>(p: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; class?: string }): Node {
  const wrap = (<div class={cls('segmented', p.class)} role="tablist" />) as HTMLElement;
  for (const o of p.options) {
    const b = (
      <button type="button" role="tab" class={cls('seg', o.value === p.value && 'active')} aria-selected={String(o.value === p.value)}>
        {o.label}
      </button>
    ) as HTMLButtonElement;
    b.addEventListener('click', () => {
      wrap.querySelectorAll('.seg').forEach((x) => {
        x.classList.remove('active');
        x.setAttribute('aria-selected', 'false');
      });
      b.classList.add('active');
      b.setAttribute('aria-selected', 'true');
      p.onChange(o.value);
    });
    wrap.appendChild(b);
  }
  return wrap;
}

/** 1–5 score picker with big tap targets. */
export function Score(p: { label: string; value: number | null; low: string; high: string; onChange: (v: number | null) => void }): Node {
  const opts = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));
  return (
    <div class="field">
      <div class="field-label row between">
        <span>{p.label}</span>
        <span class="muted small">
          1 = {p.low} · 5 = {p.high}
        </span>
      </div>
      {Segmented({ options: opts, value: p.value ? String(p.value) : '', onChange: (v) => p.onChange(Number(v)) })}
    </div>
  );
}

export function Pill(p: { children?: Child; tone?: 'accent' | 'warn' | 'muted' | 'good' | 'est' }): Node {
  return <span class={cls('pill', `pill-${p.tone ?? 'muted'}`)}>{p.children}</span>;
}

export const EstPill = () => <Pill tone="est">est.</Pill>;
