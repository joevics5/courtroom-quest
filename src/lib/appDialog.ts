/**
 * In-app replacements for the browser's alert() and confirm(), so messages look like the
 * game instead of the plain browser box.
 *
 *   await appAlert({ title: 'Oops', message: 'Something went wrong.', tone: 'error' });
 *   if (!(await appConfirm({ message: 'End the trial?', tone: 'danger' }))) return;
 *
 * Dialogs are drawn by <AppDialogHost /> (mounted once in main.tsx). They queue, so two in a
 * row show one after the other. If no host is mounted (e.g. in a bare test) the browser's own
 * alert/confirm is used so a call never hangs.
 */
export type DialogTone = 'info' | 'success' | 'error' | 'danger';

export interface AlertOptions {
  title?: string;
  message: string;
  tone?: DialogTone;
  okLabel?: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  tone?: DialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface DialogItem {
  id: number;
  kind: 'alert' | 'confirm';
  title?: string;
  message: string;
  tone: DialogTone;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (ok: boolean) => void;
}

let nextId = 1;
let queue: DialogItem[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function subscribeDialogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The dialog currently on screen (the first in the queue). */
export function getCurrentDialog(): DialogItem | null {
  return queue[0] ?? null;
}

/** Close the current dialog with the player's answer and show the next one, if any. */
export function resolveCurrentDialog(ok: boolean): void {
  const current = queue[0];
  if (!current) return;
  queue = queue.slice(1);
  emit();
  current.resolve(ok);
}

const asOptions = <T extends { message: string }>(o: string | T): T => (typeof o === 'string' ? ({ message: o } as T) : o);

export function appAlert(input: string | AlertOptions): Promise<void> {
  const o = asOptions<AlertOptions>(input);
  if (listeners.size === 0) {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(o.message);
    return Promise.resolve();
  }
  return new Promise<void>(resolve => {
    queue = [...queue, {
      id: nextId++, kind: 'alert', title: o.title, message: o.message, tone: o.tone ?? 'info',
      confirmLabel: o.okLabel ?? 'OK', cancelLabel: '', resolve: () => resolve()
    }];
    emit();
  });
}

export function appConfirm(input: string | ConfirmOptions): Promise<boolean> {
  const o = asOptions<ConfirmOptions>(input);
  if (listeners.size === 0) {
    return Promise.resolve(typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(o.message) : false);
  }
  return new Promise<boolean>(resolve => {
    queue = [...queue, {
      id: nextId++, kind: 'confirm', title: o.title, message: o.message, tone: o.tone ?? 'info',
      confirmLabel: o.confirmLabel ?? 'YES', cancelLabel: o.cancelLabel ?? 'CANCEL', resolve
    }];
    emit();
  });
}
