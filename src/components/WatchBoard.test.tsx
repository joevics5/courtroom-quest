import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const data = vi.hoisted(() => ({ live: [] as any[], recent: [] as any[] }));
vi.mock('../integrations/supabase/client', () => {
  const builder = () => {
    let kind: 'live' | 'recent' = 'recent';
    const b: any = {
      select: () => b, eq: () => b, order: () => b, limit: () => b,
      is: () => { kind = 'live'; return b; },
      not: () => { kind = 'recent'; return b; },
      then: (res: any) => res({ data: kind === 'live' ? data.live : data.recent, error: null })
    };
    return b;
  };
  return { supabase: { from: () => builder() } };
});

import WatchBoard from './WatchBoard';
import SharedTranscript from './SharedTranscript';

const renderAt = (path = '/watch') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/watch" element={<WatchBoard />} />
        <Route path="/share/:sessionId" element={<SharedTranscript />} />
        <Route path="/" element={<p>home page</p>} />
      </Routes>
    </MemoryRouter>
  );

describe('WatchBoard', () => {
  beforeEach(() => { data.live = []; data.recent = []; });

  it('uses the game look: title, sections and friendly empty states', async () => {
    renderAt();
    expect(await screen.findByText('WATCH')).toBeTruthy();
    expect(await screen.findByText('No live trials open to spectators right now.')).toBeTruthy();
    expect(screen.getByText(/No shared trials yet/)).toBeTruthy();
    expect(screen.getByText('Live Now')).toBeTruthy();
    expect(screen.getByText('Recently Finished')).toBeTruthy();
  });

  it('lists live and finished trials as links to their transcript', async () => {
    data.live = [{ id: 's1', cases: { title: 'The Conspiracy' } }];
    data.recent = [{ id: 's2', cases: { title: 'Harbor Case' }, session_state: { playerRole: 'defense' }, verdicts: [{ outcome: 'not_guilty' }] }];
    renderAt();
    const live = await screen.findByText('The Conspiracy');
    expect(live.closest('a')!.getAttribute('href')).toBe('/share/s1');
    expect(screen.getByText('LIVE')).toBeTruthy();
    expect(screen.getByText('Harbor Case').closest('a')!.getAttribute('href')).toBe('/share/s2');
  });

  it('the back arrow and the Play button go home', async () => {
    renderAt();
    await screen.findByText('WATCH');
    expect(screen.getByRole('link', { name: 'PLAY COURTROOM QUEST' }).getAttribute('href')).toBe('/');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(screen.getByText('home page')).toBeTruthy());
  });
});

describe('SharedTranscript', () => {
  it('shows a proper not-found screen for a trial that is not shared', async () => {
    data.live = []; data.recent = [];
    // the session lookup uses .single(), which this fake does not provide, so it errors into the not-found path
    renderAt('/share/missing');
    expect(await screen.findByText('TRANSCRIPT NOT FOUND')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'PLAY COURTROOM QUEST' })).toBeTruthy();
  });
});
