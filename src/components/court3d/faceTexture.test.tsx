import { describe, expect, it } from 'vitest';
import { avatarFromSeed } from '../../lib/avatars';
import { faceSvg } from './faceTexture';

describe('face picture', () => {
  const a = avatarFromSeed('Test Person', 'counsel');

  it('is a standalone svg of just the face window, with a size', () => {
    const svg = faceSvg(a, false);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="48 54 104 104"');
    expect(svg).toContain('width="256" height="256"');
  });

  it('has no backdrop, clothes or rank gear', () => {
    const svg = faceSvg({ ...a, attire: 'robe' }, false);
    expect(svg).not.toContain('data-gear');
    expect(svg).not.toContain('-bg)'); // no backdrop rectangle
    expect(svg).not.toMatch(/<rect width="200" height="200"/);
  });

  it('the talking picture has the mouth held open and still, no animation', () => {
    const closed = faceSvg(a, false), open = faceSvg(a, true);
    expect(open).not.toBe(closed);
    expect(open).not.toContain('animateTransform');
    expect(open).toContain('#4a1414'); // the open mouth's dark inside
    expect(closed).not.toContain('#4a1414');
  });

  it('carries the face settings: glasses, beard, skin tone', () => {
    const plain = faceSvg({ ...a, glasses: false, beard: 'none', gender: 'male' }, false);
    const withBoth = faceSvg({ ...a, glasses: true, beard: 'full', gender: 'male' }, false);
    expect(withBoth.length).toBeGreaterThan(plain.length);
    expect(faceSvg({ ...a, skin: 0 }, false)).not.toBe(faceSvg({ ...a, skin: 5 }, false));
  });
});
