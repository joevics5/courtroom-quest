import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourtroomScene from './CourtroomScene';
import type { StageCast } from './types';
import { COUNSEL_AVATARS, JUDGE_AVATARS } from '../../lib/avatars';
import { witnessAvatar } from '../../lib/stageCast';

const cast: StageCast = {
  judge: { name: 'Justice Williams', avatar: JUDGE_AVATARS[0], rank: 6 },
  prosecution: { name: 'DA Harrison', avatar: COUNSEL_AVATARS[0], rank: 4 },
  defense: { name: 'Ada', avatar: COUNSEL_AVATARS[1], rank: 2 }
};
const witness = { name: 'Dr. Okoro', avatar: witnessAvatar('Dr. Okoro') };
const jurors = Array.from({ length: 12 }, (_, i) => ({ id: `j${i}`, name: `Juror ${i}` }));
const current = () => Array.from(document.querySelectorAll('[aria-current="true"]'));
const seat = (name: string) => document.querySelector(`[data-seat="${name}"]`) as HTMLElement;

describe('CourtroomScene', () => {
  it('highlights only the side holding the floor, and that side stands up', () => {
    render(<CourtroomScene cast={cast} active="defense" talking={false} />);
    expect(current()).toHaveLength(1);
    expect(current()[0].getAttribute('data-seat')).toBe('Defense');
    expect(seat('Defense').style.transform).toContain('scale');
    expect(seat('Prosecution').style.transform).not.toContain('scale');
  });

  it('the judge glows but does not stand', () => {
    render(<CourtroomScene cast={cast} active="judge" talking />);
    expect(current()[0].getAttribute('data-seat')).toBe('Judge');
    expect(seat('Judge').style.transform).not.toContain('scale');
  });

  it('the witness is hidden until called, then appears on the stand', () => {
    const { rerender } = render(<CourtroomScene cast={cast} active="prosecution" talking={false} />);
    expect(seat('Witness')).toBeNull();
    rerender(<CourtroomScene cast={cast} active="witness" talking witness={witness} />);
    expect(seat('Witness').style.opacity).toBe('1');
    expect(current()[0].getAttribute('data-seat')).toBe('Witness');
  });

  it('seats the jury and highlights the box when the jury has the floor', () => {
    render(<CourtroomScene cast={cast} active="jury" talking={false} jurors={jurors} />);
    expect(current()[0].getAttribute('data-seat')).toBe('jury');
    expect(seat('jury').children).toHaveLength(12);
  });

  it('shows deliberation votes over the jurors', () => {
    render(
      <CourtroomScene
        cast={cast}
        active="jury"
        talking={false}
        jurors={jurors}
        jurorVotes={{ j0: 'GUILTY', j1: 'NOT_GUILTY', j2: 'GUILTY' }}
      />
    );
    expect(document.querySelectorAll('[data-vote="GUILTY"]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-vote="NOT_GUILTY"]')).toHaveLength(1);
  });

  it('shows the turn badge', () => {
    render(<CourtroomScene cast={cast} active="defense" talking={false} turn={{ kind: 'you', label: 'YOUR TURN' }} />);
    expect(screen.getByRole('status').textContent).toBe('YOUR TURN');
  });
});

describe('witnessAvatar', () => {
  it('gives the same witness the same face every time', () => {
    expect(witnessAvatar('Dr. Okoro')).toEqual(witnessAvatar('Dr. Okoro'));
  });
  it('draws from a pool of at most ten faces', () => {
    const faces = new Set(Array.from({ length: 80 }, (_, i) => JSON.stringify(witnessAvatar(`Witness ${i}`))));
    expect(faces.size).toBeLessThanOrEqual(10);
    expect(faces.size).toBeGreaterThan(1);
  });
});
