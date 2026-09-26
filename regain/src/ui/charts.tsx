import { formatShort } from '../domain/dates.js';
import { h } from './h.js';

/**
 * Lightweight SVG charts (no library). Single-series marks in the accent colour, recessive
 * grid, a dashed neutral target line, and tap/hover to read exact values.
 */

const W = 340;
const PAD = { l: 34, r: 10, t: 12, b: 22 };

interface Point {
  x: string; // date key or label
  y: number | null;
  label?: string;
}

function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

/** Axis bounds snapped to "nice" steps so ticks read 0 / 500 / 1,000 rather than 672 / 1,344. */
function niceScale(min: number, max: number, zeroBased: boolean, count = 4): { lo: number; hi: number; ticks: number[] } {
  if (zeroBased) min = 0;
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = zeroBased ? 0 : (max - min) * 0.1;
  const step = niceStep((max - min + 2 * pad) / count);
  const lo = zeroBased ? 0 : Math.floor((min - pad) / step) * step;
  const hi = Math.ceil((max + pad) / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { lo, hi, ticks };
}

const tickFmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1));

function frame(height: number, scale: { lo: number; hi: number; ticks: number[] }, xLabels: { i: number; text: string }[], n: number, band = false) {
  const { lo: yMin, hi: yMax } = scale;
  const ih = height - PAD.t - PAD.b;
  const iw = W - PAD.l - PAD.r;
  // band = bar charts: each category gets an equal slot, so edge bars are never clipped
  const sx = (i: number) => PAD.l + (band ? ((i + 0.5) / n) * iw : n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const sy = (v: number) => PAD.t + ih - ((v - yMin) / (yMax - yMin)) * ih;
  const grid = scale.ticks.map((t) => (
    <g>
      <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} class="grid-line" />
      <text x={PAD.l - 6} y={sy(t) + 3.5} class="axis-text" text-anchor="end">
        {tickFmt(t)}
      </text>
    </g>
  ));
  const xl = xLabels.map((l) => (
    <text x={sx(l.i)} y={height - 6} class="axis-text" text-anchor="middle">
      {l.text}
    </text>
  ));
  return { sx, sy, grid, xl, iw };
}

function pickLabels(xs: string[], max = 5): { i: number; text: string }[] {
  if (!xs.length) return [];
  const step = Math.max(1, Math.ceil(xs.length / max));
  const out: { i: number; text: string }[] = [];
  for (let i = 0; i < xs.length; i += step) out.push({ i, text: /^\d{4}-/.test(xs[i]) ? formatShort(xs[i]) : xs[i] });
  return out;
}

function attachTooltip(wrap: HTMLElement, svg: SVGSVGElement, n: number, sx: (i: number) => number, text: (i: number) => string | null) {
  const tip = (<div class="chart-tip" />) as HTMLElement;
  const cursor = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  cursor.setAttribute('class', 'cursor-line');
  cursor.setAttribute('y1', String(PAD.t));
  cursor.setAttribute('y2', String(Number(svg.getAttribute('height')) - PAD.b));
  cursor.style.display = 'none';
  svg.appendChild(cursor);
  wrap.appendChild(tip);
  const show = (clientX: number) => {
    const r = svg.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(sx(i) - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    const t = text(best);
    if (!t) return hide();
    tip.textContent = t;
    tip.style.display = 'block';
    const px = (sx(best) / W) * r.width;
    tip.style.left = `${Math.min(Math.max(px, 60), r.width - 60)}px`;
    cursor.setAttribute('x1', String(sx(best)));
    cursor.setAttribute('x2', String(sx(best)));
    cursor.style.display = 'block';
  };
  const hide = () => {
    tip.style.display = 'none';
    cursor.style.display = 'none';
  };
  svg.addEventListener('pointerdown', (e) => show(e.clientX));
  svg.addEventListener('pointermove', (e) => (e.pointerType === 'mouse' || e.buttons) && show(e.clientX));
  svg.addEventListener('pointerleave', hide);
}

export function LineChart(p: { daily: Point[]; avg: Point[]; height?: number; unit: string; target?: number | null }): Node {
  const height = p.height ?? 180;
  const xs = p.daily.map((d) => d.x);
  const vals = [...p.daily, ...p.avg].map((d) => d.y).filter((v): v is number => v !== null);
  if (!vals.length) return <div class="chart-empty muted small">No data in this range yet.</div>;
  const n = xs.length;
  const { sx, sy, grid, xl } = frame(height, niceScale(Math.min(...vals), Math.max(...vals), false), pickLabels(xs), n);
  const idx = new Map(xs.map((x, i) => [x, i]));
  const avgPts = p.avg.filter((a) => a.y !== null && idx.has(a.x));
  const path = avgPts.map((a, k) => `${k ? 'L' : 'M'}${sx(idx.get(a.x) as number).toFixed(1)},${sy(a.y as number).toFixed(1)}`).join(' ');
  const svg = (
    <svg class="chart" viewBox={`0 0 ${W} ${height}`} width={W} height={height} role="img" aria-label="Weight trend chart">
      {grid}
      {xl}
      {p.daily.map((d, i) => (d.y === null ? null : <circle cx={sx(i)} cy={sy(d.y)} r="3" class="dot-daily" />))}
      {path ? <path d={path} class="line-avg" /> : null}
    </svg>
  ) as SVGSVGElement;
  const wrap = (
    <div class="chart-wrap">
      {svg}
      <div class="legend">
        <span>
          <i class="lg-dot" /> Daily weigh-in
        </span>
        <span>
          <i class="lg-line" /> 7-day average
        </span>
      </div>
    </div>
  ) as HTMLElement;
  const avgBy = new Map(p.avg.map((a) => [a.x, a.y]));
  attachTooltip(wrap, svg, n, sx, (i) => {
    const d = p.daily[i];
    const a = avgBy.get(d.x);
    if (d.y === null && (a === null || a === undefined)) return null;
    return `${formatShort(d.x)} · ${d.y !== null ? `${d.y.toFixed(1)} ${p.unit}` : 'no weigh-in'}${a != null ? ` · avg ${a.toFixed(2)}` : ''}`;
  });
  return wrap;
}

export function BarChart(p: { bars: Point[]; target?: number | null; height?: number; unit: string; tone?: 'accent' | 'protein'; name: string; zeroMissing?: boolean }): Node {
  const height = p.height ?? 170;
  const vals = p.bars.map((b) => b.y).filter((v): v is number => v !== null);
  if (!vals.length) return <div class="chart-empty muted small">No data in this range yet.</div>;
  const n = p.bars.length;
  const { sx, sy, grid, xl, iw } = frame(height, niceScale(0, Math.max(...vals, p.target ?? 0) * 1.05, true), pickLabels(p.bars.map((b) => b.label ?? b.x), 6), n, true);
  const bw = Math.max(3, Math.min(26, (iw / n) * 0.62));
  const base = sy(0);
  const svg = (
    <svg class="chart" viewBox={`0 0 ${W} ${height}`} width={W} height={height} role="img" aria-label={`${p.name} chart`}>
      {grid}
      {xl}
      {p.bars.map((b, i) => {
        if (b.y === null || b.y <= 0) return null;
        const top = sy(b.y);
        const hgt = Math.max(1, base - top);
        const r = Math.min(4, bw / 2, hgt);
        const x = sx(i) - bw / 2;
        // rounded top corners, square base
        const d = `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z`;
        return <path d={d} class={`bar bar-${p.tone ?? 'accent'}`} />;
      })}
      {p.target ? (
        <g>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(p.target)} y2={sy(p.target)} class="target-line" />
          <text x={W - PAD.r} y={sy(p.target) - 4} class="axis-text target-text" text-anchor="end">
            target {Math.round(p.target).toLocaleString()}
          </text>
        </g>
      ) : null}
    </svg>
  ) as SVGSVGElement;
  const wrap = (<div class="chart-wrap">{svg}</div>) as HTMLElement;
  attachTooltip(wrap, svg, n, sx, (i) => {
    const b = p.bars[i];
    const name = b.label ?? (/^\d{4}-/.test(b.x) ? formatShort(b.x) : b.x);
    return b.y === null ? `${name} · not logged` : `${name} · ${Math.round(b.y).toLocaleString()} ${p.unit}`;
  });
  return wrap;
}
