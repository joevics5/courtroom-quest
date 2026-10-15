import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useElementHeight } from './useElementHeight';

function Probe() {
  const [ref, h] = useElementHeight<HTMLDivElement>();
  return <div ref={ref} data-testid="bar">{h}</div>;
}

describe('useElementHeight', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('measures the element and follows it when it resizes', () => {
    let height = 120;
    let notify: () => void = () => {};
    vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { notify = cb; } observe() {} disconnect() {} });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ height } as DOMRect));
    render(<Probe />);
    expect(screen.getByTestId('bar').textContent).toBe('120');
    height = 188;
    act(() => notify());
    expect(screen.getByTestId('bar').textContent).toBe('188');
  });
});
