import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PlayModePopup from './PlayModePopup';

describe('PlayModePopup', () => {
  it('the X button closes it', () => {
    const onClose = vi.fn();
    render(<PlayModePopup onClose={onClose} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('tapping outside closes it, tapping inside does not', () => {
    const onClose = vi.fn();
    render(<PlayModePopup onClose={onClose} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByText('HOW DO YOU WANT TO PLAY?'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(<PlayModePopup onClose={onClose} onSelect={vi.fn()} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('is drawn directly in <body>, clear of any page container', () => {
    const { container } = render(<div id="page"><PlayModePopup onClose={vi.fn()} onSelect={vi.fn()} /></div>);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.querySelector(':scope > [role="dialog"]')).not.toBeNull();
  });
});
