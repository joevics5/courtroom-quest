import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const signUp = vi.fn();
const signIn = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ signUp: (...a: unknown[]) => signUp(...a), signIn: (...a: unknown[]) => signIn(...a) })
}));

import Auth from './Auth';

const fill = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText('EMAIL'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('PASSWORD'), { target: { value: password } });
};

describe('Auth', () => {
  beforeEach(() => {
    signUp.mockReset();
    signIn.mockReset();
    signUp.mockResolvedValue({ error: null });
    signIn.mockResolvedValue({ error: null });
  });

  it('starts on sign in and has no name field', () => {
    render(<Auth />);
    expect(screen.getByText('WELCOME BACK')).toBeTruthy();
    expect(screen.queryByLabelText(/name/i)).toBeNull();
    expect(screen.getByRole('tab', { name: 'SIGN IN' }).getAttribute('aria-selected')).toBe('true');
  });

  it('sign in calls signIn with the details', async () => {
    render(<Auth />);
    fill('ada@example.com', 'secret1');
    fireEvent.submit(screen.getByLabelText('EMAIL').closest('form')!);
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('ada@example.com', 'secret1'));
    expect(signUp).not.toHaveBeenCalled();
  });

  it('sign up asks only for email and password; the name comes next (username step)', async () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole('tab', { name: 'SIGN UP' }));
    expect(screen.getByText('JOIN THE BAR')).toBeTruthy();
    expect(screen.queryByLabelText(/name/i)).toBeNull();
    fill('new@example.com', 'secret1');
    fireEvent.submit(screen.getByLabelText('EMAIL').closest('form')!);
    await waitFor(() => expect(signUp).toHaveBeenCalledWith('new@example.com', 'secret1', ''));
    expect(signIn).not.toHaveBeenCalled();
  });

  it('shows the error from the server, and clears it when switching tabs', async () => {
    signIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<Auth />);
    fill('ada@example.com', 'wrong-pass');
    fireEvent.submit(screen.getByLabelText('EMAIL').closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid login credentials');
    fireEvent.click(screen.getByRole('tab', { name: 'SIGN UP' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows an unexpected failure plainly', async () => {
    signIn.mockRejectedValue(new Error('boom'));
    render(<Auth />);
    fill('ada@example.com', 'secret1');
    fireEvent.submit(screen.getByLabelText('EMAIL').closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toBe('An unexpected error occurred');
  });

  it('can show and hide the password', () => {
    render(<Auth />);
    const input = screen.getByLabelText('PASSWORD') as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input.type).toBe('password');
  });

  it('has a back button only when it can go back', () => {
    const onBack = vi.fn();
    const { rerender } = render(<Auth onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
    rerender(<Auth />);
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });
});
