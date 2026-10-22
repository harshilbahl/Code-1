import { h } from './h.js';

/** Floating rest timer shown above the tab bar after a set is logged. Wall-clock based, so it survives backgrounding. */
let endAt = 0;
let total = 0;
let label = '';
let tick: number | undefined;
let el: HTMLElement | null = null;

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export function startRest(seconds: number, name: string): void {
  total = seconds;
  endAt = Date.now() + seconds * 1000;
  label = name;
  mount();
  update();
  window.clearInterval(tick);
  tick = window.setInterval(update, 250);
}

export function stopRest(): void {
  window.clearInterval(tick);
  el?.remove();
  el = null;
  document.body.classList.remove('resting');
}

function adjust(delta: number) {
  endAt = Math.max(Date.now(), endAt + delta * 1000);
  total = Math.max(total + delta, 1);
  update();
}

function mount() {
  if (el) return;
  el = (
    <div class="rest-timer" role="timer" aria-live="off">
      <div class="rest-bar" />
      <div class="rest-body">
        <div class="grow">
          <div class="rest-time">0:00</div>
          <div class="rest-label muted small" />
        </div>
        <button type="button" class="chip" onClick={() => adjust(-15)}>
          −15
        </button>
        <button type="button" class="chip" onClick={() => adjust(15)}>
          +15
        </button>
        <button type="button" class="chip" onClick={stopRest}>
          Skip
        </button>
      </div>
    </div>
  ) as HTMLElement;
  document.body.appendChild(el);
  document.body.classList.add('resting');
}

function update() {
  if (!el) return;
  const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  (el.querySelector('.rest-time') as HTMLElement).textContent = left > 0 ? fmt(left) : 'Go';
  (el.querySelector('.rest-label') as HTMLElement).textContent = left > 0 ? `Rest · ${label}` : `Rest done · ${label}`;
  (el.querySelector('.rest-bar') as HTMLElement).style.transform = `scaleX(${total ? left / total : 0})`;
  el.classList.toggle('finished', left === 0);
  if (left === 0) {
    window.clearInterval(tick);
    try {
      navigator.vibrate?.(200);
    } catch {
      /* not supported on iOS */
    }
    setTimeout(() => {
      if (el?.classList.contains('finished')) stopRest();
    }, 8000);
  }
}
