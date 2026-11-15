import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ObjectionSelector from './ObjectionSelector';

describe('ObjectionSelector', () => {
  it('offers "Outside the Scope" only during a redirect', () => {
    const { rerender } = render(<ObjectionSelector onSelect={() => undefined} onClose={() => undefined} />);
    expect(screen.queryByText('Outside the Scope')).toBeNull();
    expect(screen.getByText('Hearsay')).toBeTruthy();
    rerender(<ObjectionSelector redirect onSelect={() => undefined} onClose={() => undefined} />);
    expect(screen.getByText('Outside the Scope')).toBeTruthy();
    expect(screen.getByText('Hearsay')).toBeTruthy();
  });

  it('reports the ground that was chosen', () => {
    const onSelect = vi.fn();
    render(<ObjectionSelector redirect onSelect={onSelect} onClose={() => undefined} />);
    fireEvent.click(screen.getByText('Outside the Scope'));
    expect(onSelect).toHaveBeenCalledWith('outside_scope');
  });
});
