import { h, type Child } from './h.js';

/* ------------------------------------------------------------------ bottom sheet */

export interface SheetHandle {
  close(): void;
  /** Replace the sheet body (used for multi-step sheets). */
  setContent(node: Node): void;
  el: HTMLElement;
}

let sheetStack: SheetHandle[] = [];

export function openSheet(title: string, build: (s: SheetHandle) => Node, opts: { onClose?: () => void; tall?: boolean } = {}): SheetHandle {
  const body = h('div', { class: 'sheet-body' }) as HTMLElement;
  const closeBtn = h('button', { class: 'icon-btn sheet-close', 'aria-label': 'Close', type: 'button' }, '✕');
  const panel = h(
    'div',
    { class: 'sheet' + (opts.tall ? ' tall' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-grip' }),
    h('div', { class: 'sheet-head' }, h('h2', null, title), closeBtn),
    body,
  ) as HTMLElement;
  const root = h('div', { class: 'sheet-backdrop' }, panel) as HTMLElement;

  let closed = false;
  const handle: SheetHandle = {
    el: panel,
    close() {
      if (closed) return;
      closed = true;
      root.classList.remove('open');
      sheetStack = sheetStack.filter((s) => s !== handle);
      setTimeout(() => root.remove(), 220);
      if (!sheetStack.length) document.body.classList.remove('sheet-open');
      opts.onClose?.();
    },
    setContent(node: Node) {
      body.replaceChildren(node);
    },
  };
  closeBtn.addEventListener('click', () => handle.close());
  root.addEventListener('click', (e) => {
    if (e.target === root) handle.close();
  });
  // swipe the grip/header down to dismiss
  let startY: number | null = null;
  panel.querySelector('.sheet-head')?.addEventListener('touchstart', (e) => (startY = (e as TouchEvent).touches[0].clientY), { passive: true });
  panel.querySelector('.sheet-head')?.addEventListener('touchend', (e) => {
    if (startY !== null && (e as TouchEvent).changedTouches[0].clientY - startY > 60) handle.close();
    startY = null;
  });

  body.appendChild(build(handle));
  document.body.appendChild(root);
  document.body.classList.add('sheet-open');
  sheetStack.push(handle);
  requestAnimationFrame(() => root.classList.add('open'));
  return handle;
}

export function closeTopSheet(): boolean {
  const top = sheetStack[sheetStack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

export function closeAllSheets(): void {
  [...sheetStack].forEach((s) => s.close());
}

/* ------------------------------------------------------------------ toast */

let toastTimer: number | undefined;

export function toast(message: string, action?: { label: string; run: () => void }, ms = 3500): void {
  document.querySelector('.toast')?.remove();
  const btn = action ? (h('button', { class: 'toast-action', type: 'button' }, action.label) as HTMLButtonElement) : null;
  const el = h('div', { class: 'toast', role: 'status' }, h('span', null, message), btn) as HTMLElement;
  if (btn && action) {
    btn.addEventListener('click', () => {
      action.run();
      el.remove();
    });
  }
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, ms);
}

/* ------------------------------------------------------------------ confirm */

export function confirmSheet(opts: { title: string; message: Child; confirmLabel: string; danger?: boolean; requireText?: string; onConfirm: () => void | Promise<void> }): void {
  openSheet(opts.title, (s) => {
    const input = opts.requireText
      ? (h('input', { class: 'input', autocomplete: 'off', autocapitalize: 'characters', placeholder: `Type ${opts.requireText}` }) as HTMLInputElement)
      : null;
    const ok = h('button', { class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'), type: 'button', disabled: !!opts.requireText }, opts.confirmLabel) as HTMLButtonElement;
    input?.addEventListener('input', () => (ok.disabled = input.value.trim().toUpperCase() !== opts.requireText));
    ok.addEventListener('click', async () => {
      ok.disabled = true;
      await opts.onConfirm();
      s.close();
    });
    return h(
      'div',
      { class: 'stack' },
      h('p', { class: 'muted' }, opts.message),
      input,
      h('div', { class: 'row gap' }, h('button', { class: 'btn btn-ghost grow', type: 'button', onClick: () => s.close() }, 'Cancel'), h('div', { class: 'grow' }, ok)),
    );
  });
}
