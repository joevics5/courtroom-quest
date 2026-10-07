import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const updateUser = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { updateUser: (...args: unknown[]) => updateUser(...args) } }
}));

const savePublicProfile = vi.fn();
const isUsernameAvailable = vi.fn();
vi.mock('../lib/publicProfile', () => ({
  savePublicProfile: (...args: unknown[]) => savePublicProfile(...args),
  isUsernameAvailable: (...args: unknown[]) => isUsernameAvailable(...args)
}));

import AvatarCreator from './AvatarCreator';

const typeNameAndContinue = async (name: string) => {
  fireEvent.change(screen.getByLabelText('USERNAME'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }));
};

describe('AvatarCreator', () => {
  beforeEach(() => {
    updateUser.mockReset();
    updateUser.mockResolvedValue({ error: null });
    savePublicProfile.mockReset();
    savePublicProfile.mockResolvedValue({ ok: true });
    isUsernameAvailable.mockReset();
    isUsernameAvailable.mockResolvedValue(true);
  });

  it('asks for a valid username before the avatar step', async () => {
    render(<AvatarCreator onDone={() => {}} />);
    await typeNameAndContinue('ab');
    expect(await screen.findByText(/at least 3 characters/i)).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(isUsernameAvailable).not.toHaveBeenCalled();
  });

  it('refuses a username somebody already has', async () => {
    isUsernameAvailable.mockResolvedValue(false);
    render(<AvatarCreator onDone={() => {}} />);
    await typeNameAndContinue('Counsel Ada');
    expect(await screen.findByText(/username is taken/i)).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('saves username and avatar together after signup', async () => {
    const onDone = vi.fn();
    render(<AvatarCreator onDone={onDone} />);
    await typeNameAndContinue('Counsel Ada');
    expect(await screen.findByRole('tablist')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ENTER COURT' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(savePublicProfile).toHaveBeenCalledWith(expect.objectContaining({ username: 'Counsel Ada', avatar: expect.any(Object) }));
    const data = updateUser.mock.calls[0][0].data;
    expect(data.nickname).toBe('Counsel Ada');
    expect(data.avatar).toMatchObject({ gender: expect.any(String), hairStyle: expect.any(String), headShape: expect.any(Number) });
  });

  it('goes back to the username step if the name was taken at the last moment', async () => {
    savePublicProfile.mockResolvedValue({ ok: false, error: 'taken' });
    const onDone = vi.fn();
    render(<AvatarCreator onDone={onDone} />);
    await typeNameAndContinue('Counsel Ada');
    fireEvent.click(await screen.findByRole('button', { name: 'ENTER COURT' }));
    expect(await screen.findByText(/just taken/i)).toBeTruthy();
    expect(updateUser).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('change mode skips the username and keeps the name untouched', async () => {
    const onDone = vi.fn();
    render(<AvatarCreator mode="change" onDone={onDone} onBack={() => {}} />);
    expect(screen.queryByLabelText('USERNAME')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'SAVE AVATAR' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(savePublicProfile.mock.calls[0][0].username).toBeUndefined();
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
