// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const upgradeGuest = vi.fn();
const signUp = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ signUp: (...a: unknown[]) => signUp(...a), signIn: vi.fn(), upgradeGuest: (...a: unknown[]) => upgradeGuest(...a) })
}));

import Auth from './Auth';

const submit = () => {
  fireEvent.change(screen.getByLabelText('EMAIL'), { target: { value: 'ada@example.com' } });
  fireEvent.change(screen.getByLabelText('PASSWORD'), { target: { value: 'secret1' } });
  fireEvent.submit(screen.getByLabelText('EMAIL').closest('form')!);
};

describe('Auth, saving a guest\'s progress', () => {
  beforeEach(() => { upgradeGuest.mockReset(); signUp.mockReset(); });

  it('is sign-up only and upgrades the guest instead of making a second account', async () => {
    upgradeGuest.mockResolvedValue({ error: null, needsConfirmation: false });
    const onDone = vi.fn();
    render(<Auth upgrade onDone={onDone} />);
    expect(screen.getByText('SAVE YOUR PROGRESS')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'SIGN IN' })).toBeNull();
    submit();
    await waitFor(() => expect(upgradeGuest).toHaveBeenCalledWith('ada@example.com', 'secret1'));
    expect(signUp).not.toHaveBeenCalled();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('tells the player to confirm their email when the project needs it, and lets them carry on', async () => {
    upgradeGuest.mockResolvedValue({ error: null, needsConfirmation: true });
    const onDone = vi.fn();
    render(<Auth upgrade onDone={onDone} />);
    submit();
    await screen.findByText('CHECK YOUR EMAIL');
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('CARRY ON'));
    expect(onDone).toHaveBeenCalled();
  });

  it('shows an error and stays put when the upgrade fails', async () => {
    upgradeGuest.mockResolvedValue({ error: { message: 'Email already in use' }, needsConfirmation: false });
    const onDone = vi.fn();
    render(<Auth upgrade onDone={onDone} />);
    submit();
    await screen.findByText('Email already in use');
    expect(onDone).not.toHaveBeenCalled();
  });
});
