import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BAILIFF_AVATAR, avatarFromSeed, randomAvatar } from '../../lib/avatars';
import { lookFromAvatar } from './character';
import { buildCourtroom } from './room';
import * as THREE from 'three';

describe('lookFromAvatar', () => {
  it('keeps skin, hair and gender from the 2D avatar', () => {
    const a = randomAvatar('look-1');
    const l = lookFromAvatar(a);
    expect(l.woman).toBe(a.gender === 'female');
    expect(l.glasses).toBe(a.glasses);
    expect(typeof l.skin).toBe('number');
  });
  it('dresses the judge in a robe and the bailiff in a uniform', () => {
    expect(lookFromAvatar(avatarFromSeed('Judge X', 'judge'), 'judge').robe).toBe(true);
    const b = lookFromAvatar(BAILIFF_AVATAR, 'bailiff');
    expect(b.uniform).toBe(true);
    expect(b.robe).toBe(false);
  });
  it('the same avatar always gives the same look', () => {
    const a = randomAvatar('same');
    expect(lookFromAvatar(a)).toEqual(lookFromAvatar(a));
  });
});

describe('courtroom layout', () => {
  beforeAll(() => {
    // jsdom has no canvas: give the wood texture painter a harmless 2D context
    const ctx = new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
  });
  it('has seats for 12 jurors, a witness, both counsel and a gallery, and a gate in the rail', () => {
    const room = buildCourtroom(new THREE.Scene(), { shadows: false });
    expect(room.jury).toHaveLength(12);
    expect(room.prosecution.length).toBeGreaterThanOrEqual(2);
    expect(room.defense.length).toBeGreaterThanOrEqual(2);
    expect(room.audience.length).toBeGreaterThanOrEqual(40);
    // the aisle is clear: nothing solid sits on the centre line between the door and the gate
    const blocked = room.obstacles.some(b => b.x0 < 0.4 && b.x1 > -0.4 && b.z0 < 10 && b.z1 > room.gate.z + 0.3);
    expect(blocked).toBe(false);
    // both counsel seats are reachable (not inside furniture)
    for (const s of [room.prosecution[0], room.defense[0]]) {
      expect(room.obstacles.some(b => s.x > b.x0 - 0.38 && s.x < b.x1 + 0.38 && s.z > b.z0 - 0.38 && s.z < b.z1 + 0.38)).toBe(false);
    }
  });
});
