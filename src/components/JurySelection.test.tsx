import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRandomJurors: vi.fn(),
  getJurorsByIds: vi.fn(),
  getSessionJurySelections: vi.fn(),
  addJurySelection: vi.fn(),
  removeJurySelection: vi.fn()
}));

vi.mock('../lib/database', () => ({
  db: {
    jurors: { getRandomJurors: mocks.getRandomJurors, getJurorsByIds: mocks.getJurorsByIds },
    jurySelections: {
      getSessionJurySelections: mocks.getSessionJurySelections,
      addJurySelection: mocks.addJurySelection,
      removeJurySelection: mocks.removeJurySelection
    }
  }
}));

import JurySelection from './JurySelection';

const juror = (id: string, name: string, occupation: string) => ({
  id, name, age: 40, occupation, background: `${name} background`, personality_traits: ['Fair'], biases: [], created_at: ''
});
const POOL = [juror('j1', 'Robert Jenkins', 'Retired Supervisor'), juror('j2', 'Sarah Whitfield', 'Attorney'), juror('j3', 'Kwame Mensah', 'Teacher')];

let nextId = 1;
beforeEach(() => {
  nextId = 1;
  mocks.getRandomJurors.mockReset().mockResolvedValue(POOL);
  mocks.getJurorsByIds.mockReset().mockResolvedValue([]);
  mocks.getSessionJurySelections.mockReset().mockResolvedValue([]);
  mocks.removeJurySelection.mockReset().mockResolvedValue(undefined);
  mocks.addJurySelection.mockReset().mockImplementation(async (s: Record<string, unknown>) => ({ id: `sel-${nextId++}`, ...s }));
});

describe('JurySelection', () => {
  it('lists the pool and starts with nothing seated and the proceed button locked', async () => {
    render(<JurySelection sessionId="s1" maxJurors={2} onComplete={vi.fn()} />);
    expect(await screen.findByText('Robert Jenkins')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'PICK' })).toHaveLength(3);
    expect(screen.getByText(/Your pick — 1 more for the defense/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PICK 1 MORE JUROR/ })).toBeDisabled();
  });

  it('seats your pick, lets the prosecution pick, then unlocks Proceed to Trial', async () => {
    const onComplete = vi.fn();
    render(<JurySelection sessionId="s1" maxJurors={2} onComplete={onComplete} />);
    await screen.findByText('Robert Jenkins');

    fireEvent.click(screen.getAllByRole('button', { name: 'PICK' })[0]);
    // picked juror leaves the pool and appears in a seat
    await waitFor(() => expect(screen.queryByText('Robert Jenkins')).toBeNull());
    expect(screen.getByRole('button', { name: /Remove Robert Jenkins/ })).toBeInTheDocument();
    expect(await screen.findByText(/prosecution is choosing/i)).toBeInTheDocument();

    const proceed = await screen.findByRole('button', { name: /PROCEED TO TRIAL/ }, { timeout: 3000 });
    expect(proceed).toBeEnabled();
    expect(mocks.addJurySelection).toHaveBeenCalledTimes(2);
    expect(mocks.addJurySelection.mock.calls[0][0]).toMatchObject({ juror_id: 'j1', selected_by: 'defense' });
    expect(mocks.addJurySelection.mock.calls[1][0]).toMatchObject({ selected_by: 'prosecution' });
    fireEvent.click(proceed);
    expect(onComplete).toHaveBeenCalled();
  });

  it('removing a seated juror puts them back in the pool', async () => {
    render(<JurySelection sessionId="s1" maxJurors={2} onComplete={vi.fn()} />);
    await screen.findByText('Robert Jenkins');
    fireEvent.click(screen.getAllByRole('button', { name: 'PICK' })[0]);
    await screen.findByRole('button', { name: /PROCEED TO TRIAL/ }, { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: /Remove Robert Jenkins/ }));
    await waitFor(() => expect(mocks.removeJurySelection).toHaveBeenCalledWith('sel-1'));
    expect(await screen.findByText('Robert Jenkins')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /PROCEED TO TRIAL/ })).toBeNull();
  });

  it('a resumed game still shows jurors picked earlier, even if they are not in today\'s random pool', async () => {
    const earlier = juror('old', 'Margaret Oyelaran', 'Nurse');
    mocks.getSessionJurySelections.mockResolvedValue([{ id: 'sel-old', session_id: 's1', juror_id: 'old', selected_by: 'defense', selection_order: 1 }]);
    mocks.getJurorsByIds.mockResolvedValue([earlier]);
    render(<JurySelection sessionId="s1" maxJurors={4} onComplete={vi.fn()} />);
    expect(await screen.findByRole('button', { name: /Remove Margaret Oyelaran/ })).toBeInTheDocument();
    expect(mocks.getJurorsByIds).toHaveBeenCalledWith(['old']);
  });
});
