import type { KeyboardEvent } from 'react';

/**
 * Tab moves to the next line inside a text box instead of jumping to the next button.
 * Shift+Tab still moves focus away, so keyboard users are never trapped in the box.
 * Returns the new text when it handled the key, or null when it did nothing.
 */
export function newlineOnTab(
  e: Pick<KeyboardEvent<HTMLTextAreaElement>, 'key' | 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey' | 'preventDefault'> & {
    currentTarget: Pick<HTMLTextAreaElement, 'selectionStart' | 'selectionEnd'> & { setSelectionRange?: HTMLTextAreaElement['setSelectionRange'] };
  },
  value: string,
  setValue: (next: string) => void
): string | null {
  if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return null;
  e.preventDefault();
  const el = e.currentTarget;
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? start;
  const next = `${value.slice(0, start)}\n${value.slice(end)}`;
  setValue(next);
  // put the cursor right after the new line once React has re-rendered the text
  requestAnimationFrame(() => el.setSelectionRange?.(start + 1, start + 1));
  return next;
}
