import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AvatarScene from './AvatarScene';
import type { StageCast } from './types';
import { COUNSEL_AVATARS, JUDGE_AVATARS } from '../../lib/avatars';

const cast: StageCast = {
  judge: { name: 'Justice Williams', avatar: JUDGE_AVATARS[0], rank: 6 },
  prosecution: { name: 'DA Harrison', avatar: COUNSEL_AVATARS[0], rank: 4 },
  defense: { name: 'Ada', avatar: COUNSEL_AVATARS[1], rank: 2 }
};

const current = () => document.querySelectorAll('[aria-current="true"]');

describe('AvatarScene', () => {
  it('highlights only the active person', () => {
    render(<AvatarScene cast={cast} active="defense" talking={false} />);
    expect(current()).toHaveLength(1);
    expect(current()[0].textContent).toContain('Ada');
  });

  it('shows rank titles for counsel but not for the judge', () => {
    render(<AvatarScene cast={cast} active="judge" talking={false} />);
    expect(screen.getByText(/Prosecution · Senior Attorney/)).toBeTruthy();
    expect(screen.getByText(/Defense · Associate Attorney/)).toBeTruthy();
    expect(screen.getByText('Judge')).toBeTruthy();
  });

  it('shows the turn badge, gold for the player', () => {
    render(<AvatarScene cast={cast} active="defense" talking={false} turn={{ kind: 'you', label: 'YOUR TURN' }} />);
    expect(screen.getByRole('status').textContent).toBe('YOUR TURN');
  });

  it('labels a witness or jury turn, which has no tile', () => {
    const { rerender } = render(<AvatarScene cast={cast} active="witness" talking={false} />);
    expect(screen.getByText('Witness speaking')).toBeTruthy();
    expect(current()).toHaveLength(0);
    rerender(<AvatarScene cast={cast} active="jury" talking={false} />);
    expect(screen.getByText('Jury deliberating')).toBeTruthy();
  });

  it('compact mode keeps faces and names but drops the role line', () => {
    render(<AvatarScene cast={cast} active="judge" talking={false} compact />);
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.queryByText(/Defense · Associate/)).toBeNull();
  });
});
