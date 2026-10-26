import { describe, it, expect } from 'vitest';
import { lockPageScroll } from './useLockPageScroll';

describe('lockPageScroll', () => {
  it('locks the page and restores what was there before', () => {
    document.body.style.overflow = 'auto';
    const unlock = lockPageScroll();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overscrollBehavior).toBe('none');
    unlock();
    expect(document.body.style.overflow).toBe('auto');
    expect(document.documentElement.style.overflow).toBe('');
  });
});
