import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import TrialStage from './TrialStage';
import { STAGE_SCENES, DEFAULT_SCENE } from './stage/scenes';
import { COUNSEL_AVATARS, JUDGE_AVATARS } from '../lib/avatars';

const base = {
  currentSpeaker: 'judge' as const,
  judge: { name: 'Justice Williams', avatar: JUDGE_AVATARS[0] },
  prosecution: { name: 'DA Harrison', avatar: COUNSEL_AVATARS[0] },
  defense: { name: 'Ada', avatar: COUNSEL_AVATARS[1] }
};
const highlighted = () => document.querySelector('[aria-current="true"]')?.textContent ?? '';

describe('TrialStage slot', () => {
  it('registers the avatar scene as the default', () => {
    expect(DEFAULT_SCENE).toBe('avatars');
    expect(STAGE_SCENES.avatars).toBeTypeOf('function');
  });

  it('after the judge has spoken, the glow goes to whoever has the turn', () => {
    render(<TrialStage {...base} lastRole="judge" floor="defense" />);
    expect(highlighted()).toContain('Ada');
  });

  it('falls back to the latest speaker when the turn is unknown', () => {
    render(<TrialStage {...base} lastRole="prosecution" floor={null} />);
    expect(highlighted()).toContain('DA Harrison');
  });

  it('falls back to the default scene for an unknown scene id', () => {
    render(<TrialStage {...base} lastRole="judge" floor="prosecution" scene={'nope' as never} />);
    expect(highlighted()).toContain('DA Harrison');
  });
});
