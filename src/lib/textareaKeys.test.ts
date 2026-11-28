import { describe, it, expect, vi } from 'vitest';
import { newlineOnTab } from './textareaKeys';

function key(over: Partial<Parameters<typeof newlineOnTab>[0]> = {}, sel = [5, 5]) {
  return {
    key: 'Tab', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
    preventDefault: vi.fn(),
    currentTarget: { selectionStart: sel[0], selectionEnd: sel[1], setSelectionRange: vi.fn() },
    ...over
  } as Parameters<typeof newlineOnTab>[0];
}

describe('newlineOnTab', () => {
  it('puts a new line where the cursor is and stops the focus jump', () => {
    const setValue = vi.fn();
    const e = key();
    expect(newlineOnTab(e, 'HelloWorld', setValue)).toBe('Hello\nWorld');
    expect(setValue).toHaveBeenCalledWith('Hello\nWorld');
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('replaces selected text with the new line', () => {
    const setValue = vi.fn();
    expect(newlineOnTab(key({}, [2, 7]), 'Hello World', setValue)).toBe('He\norld');
  });

  it('works at the end of the text', () => {
    const setValue = vi.fn();
    expect(newlineOnTab(key({}, [5, 5]), 'Hello', setValue)).toBe('Hello\n');
  });

  it('leaves Shift+Tab alone so keyboard users can leave the box', () => {
    const setValue = vi.fn();
    const e = key({ shiftKey: true });
    expect(newlineOnTab(e, 'Hello', setValue)).toBeNull();
    expect(setValue).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('ignores other keys and shortcuts', () => {
    const setValue = vi.fn();
    expect(newlineOnTab(key({ key: 'Enter' }), 'Hello', setValue)).toBeNull();
    expect(newlineOnTab(key({ ctrlKey: true }), 'Hello', setValue)).toBeNull();
    expect(setValue).not.toHaveBeenCalled();
  });
});
