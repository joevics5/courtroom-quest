import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const updateUser = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { updateUser: (...args: unknown[]) => updateUser(...args) } }
}));

import AvatarCreator from './AvatarCreator';

describe('AvatarCreator', () => {
  beforeEach(() => {
    updateUser.mockReset();
    updateUser.mockResolvedValue({ error: null });
  });

  it('asks for a valid username before the avatar step', () => {
    render(<AvatarCreator onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText('USERNAME'), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }));
    expect(screen.getByText(/at least 3 characters/i)).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('saves username and avatar together after signup', async () => {
    const onDone = vi.fn();
    render(<AvatarCreator onDone={onDone} />);
    fireEvent.change(screen.getByLabelText('USERNAME'), { target: { value: 'Counsel Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }));
    expect(screen.getByRole('tablist')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ENTER COURT' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const data = updateUser.mock.calls[0][0].data;
    expect(data.nickname).toBe('Counsel Ada');
    expect(data.avatar).toMatchObject({ hairStyle: expect.any(String), headShape: expect.any(Number) });
  });

  it('change mode skips the username and keeps the name untouched', async () => {
    const onDone = vi.fn();
    render(<AvatarCreator mode="change" onDone={onDone} onBack={() => {}} />);
    expect(screen.queryByLabelText('USERNAME')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'SAVE AVATAR' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(updateUser.mock.calls[0][0].data.nickname).toBeUndefined();
  });

  it('shows an error and stays put when saving fails', async () => {
    updateUser.mockResolvedValue({ error: new Error('offline') });
    const onDone = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AvatarCreator mode="change" onDone={onDone} onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'SAVE AVATAR' }));
    await screen.findByText(/could not save/i);
    expect(onDone).not.toHaveBeenCalled();
  });
});
