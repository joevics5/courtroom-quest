import { beforeEach, describe, expect, it } from 'vitest';
import { markTutorialSeen, tutorialAlreadySeen } from './tutorialSeen';

const fresh = { tutorial_completed: false, trial_count: 0, wins_count: 0 };
const member = { id: 'u1', is_anonymous: false, user_metadata: {} };
const guest = (id: string) => ({ id, is_anonymous: true, user_metadata: {} });

describe('tutorialAlreadySeen', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows the wizard to a brand-new player', () => {
    expect(tutorialAlreadySeen(fresh, member)).toBe(false);
  });

  it('does not show it again once the database flag is set', () => {
    expect(tutorialAlreadySeen({ ...fresh, tutorial_completed: true }, member)).toBe(true);
  });

  it('stays closed even when saving to the database failed (browser record)', () => {
    markTutorialSeen(member);
    expect(tutorialAlreadySeen(fresh, member)).toBe(true);
  });

  it('stays closed when the account metadata says done (other device)', () => {
    expect(tutorialAlreadySeen(fresh, { ...member, user_metadata: { tutorial_done: true } })).toBe(true);
  });

  it('never shows it to someone who has already played', () => {
    expect(tutorialAlreadySeen({ ...fresh, trial_count: 2 }, member)).toBe(true);
    expect(tutorialAlreadySeen({ ...fresh, wins_count: 1 }, member)).toBe(true);
  });

  it('shows it once per device for guests, since each guest is a new account', () => {
    expect(tutorialAlreadySeen(fresh, guest('g1'))).toBe(false);
    markTutorialSeen(guest('g1'));
    expect(tutorialAlreadySeen(fresh, guest('g2'))).toBe(true);
  });

  it('a new registered account on the same device still gets its own first run', () => {
    markTutorialSeen(guest('g1'));
    expect(tutorialAlreadySeen(fresh, { id: 'u9', is_anonymous: false, user_metadata: {} })).toBe(false);
  });
});
