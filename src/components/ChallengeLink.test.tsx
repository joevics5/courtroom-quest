import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const getChallengePreview = vi.fn();
const joinChallenge = vi.fn();
const getSession = vi.fn();
vi.mock('../lib/database', () => ({
  db: {
    challenges: { getChallengePreview: (...a: unknown[]) => getChallengePreview(...a), joinChallenge: (...a: unknown[]) => joinChallenge(...a) },
    sessions: { getSession: (...a: unknown[]) => getSession(...a) }
  }
}));
vi.mock('./ScreenShell', () => ({ default: ({ children, title }: any) => <div><h1>{title}</h1>{children}</div> }));

import ChallengeLink from './ChallengeLink';

const preview = (over: Record<string, unknown> = {}) => ({
  id: 'c1', case_id: 'case', case_title: 'The Playlist Plagiarist', creator_role: 'defense', creator_name: 'Ada',
  status: 'open', is_public: false, is_mine: false, is_opponent: false, session_id: null, ...over
});

const setup = () => {
  const props = { challengeId: 'c1', userId: 'me', onPlayAsGuest: vi.fn(), onSignIn: vi.fn(), onAccepted: vi.fn(), onDismiss: vi.fn(), onViewGames: vi.fn() };
  render(<ChallengeLink {...props} />);
  return props;
};

beforeEach(() => { getChallengePreview.mockReset(); joinChallenge.mockReset(); getSession.mockReset(); });

describe('ChallengeLink', () => {
  it('lets a visitor accept an open challenge and goes into the game', async () => {
    getChallengePreview.mockResolvedValue(preview());
    joinChallenge.mockResolvedValue({ id: 's1' });
    const props = setup();
    fireEvent.click(await screen.findByText('ACCEPT CHALLENGE'));
    await waitFor(() => expect(props.onAccepted).toHaveBeenCalledWith({ id: 's1' }));
    expect(joinChallenge).toHaveBeenCalledWith('c1');
  });

  it('shows "accepted" and opens the case for the player who accepted', async () => {
    getChallengePreview.mockResolvedValue(preview({ status: 'matched', is_opponent: true, session_id: 's1' }));
    getSession.mockResolvedValue({ id: 's1' });
    const props = setup();
    await screen.findByText('CHALLENGE ACCEPTED');
    expect(screen.queryByText('ACCEPT CHALLENGE')).toBeNull();
    fireEvent.click(screen.getByText('CONTINUE'));
    await waitFor(() => expect(props.onAccepted).toHaveBeenCalledWith({ id: 's1' }));
    expect(getSession).toHaveBeenCalledWith('s1');
  });

  it('shows the creator that their challenge was accepted, not "your own link"', async () => {
    getChallengePreview.mockResolvedValue(preview({ status: 'matched', is_mine: true, opponent_name: 'Bo', session_id: 's1' }));
    setup();
    await screen.findByText('CHALLENGE ACCEPTED');
    expect(screen.getByText(/Bo accepted your challenge/)).toBeTruthy();
    expect(screen.getByText('CONTINUE')).toBeTruthy();
    expect(screen.queryByText(/your own challenge link/)).toBeNull();
  });

  it('tells a third person it was already accepted, with no way to accept again', async () => {
    getChallengePreview.mockResolvedValue(preview({ status: 'matched' }));
    setup();
    await screen.findByText('CHALLENGE ACCEPTED');
    expect(screen.getByText(/already been accepted by another player/)).toBeTruthy();
    expect(screen.queryByText('ACCEPT CHALLENGE')).toBeNull();
    expect(screen.queryByText('CONTINUE')).toBeNull();
  });

  it('says so when the challenge was cancelled', async () => {
    getChallengePreview.mockResolvedValue(preview({ status: 'cancelled' }));
    setup();
    await screen.findByText(/cancelled by its creator/);
    expect(screen.queryByText('ACCEPT CHALLENGE')).toBeNull();
  });

  it('shows the creator their own waiting link', async () => {
    getChallengePreview.mockResolvedValue(preview({ is_mine: true }));
    const props = setup();
    await screen.findByText(/your own challenge link, still waiting/);
    expect(screen.queryByText('OK')).toBeNull();
    fireEvent.click(screen.getByText('VIEW MY GAMES'));
    expect(props.onViewGames).toHaveBeenCalled();
    expect(props.onDismiss).not.toHaveBeenCalled();
  });
});
