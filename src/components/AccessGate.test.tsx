// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AccessGate from './AccessGate';

function setup(busy = false) {
  const handlers = { onSignUp: vi.fn(), onGuest: vi.fn(), onSignIn: vi.fn(), onClose: vi.fn() };
  render(<AccessGate {...handlers} busy={busy} />);
  return handlers;
}

describe('AccessGate', () => {
  it('offers two cards: sign up and continue as a guest', () => {
    const h = setup();
    fireEvent.click(screen.getByText('SIGN UP'));
    fireEvent.click(screen.getByText('CONTINUE AS GUEST'));
    expect(h.onSignUp).toHaveBeenCalledTimes(1);
    expect(h.onGuest).toHaveBeenCalledTimes(1);
  });

  it('lets an existing player sign in instead', () => {
    const h = setup();
    fireEvent.click(screen.getByText('Sign in'));
    expect(h.onSignIn).toHaveBeenCalledTimes(1);
  });

  it('disables both cards while a guest account is being made', () => {
    setup(true);
    expect(screen.getByText('STARTING…').closest('button')).toBeDisabled();
    expect(screen.getByText('SIGN UP').closest('button')).toBeDisabled();
  });
});
