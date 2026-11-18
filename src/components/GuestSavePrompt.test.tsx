// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GuestSavePrompt from './GuestSavePrompt';

describe('GuestSavePrompt', () => {
  it('has a main button and a quiet way out', () => {
    const onPrimary = vi.fn();
    const onClose = vi.fn();
    render(<GuestSavePrompt title="Keep playing" message="Make an account." primaryLabel="SAVE MY PROGRESS" closeLabel="Maybe later" onPrimary={onPrimary} onClose={onClose} />);
    fireEvent.click(screen.getByText('SAVE MY PROGRESS'));
    fireEvent.click(screen.getByText('Maybe later'));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
