import { describe, expect, it } from 'vitest';
import { FACE_BOX, HEAD, facePoint, facePatchGeometry } from './faceMap';

describe('face picture on the 3D head', () => {
  it('puts the drawn eyes at the height of the 3D eyes, one either side of the middle', () => {
    const l = facePoint(86, 95), r = facePoint(114, 95);
    expect(l.y).toBeCloseTo(0.235, 1);
    expect(r.y).toBeCloseTo(l.y, 6);
    expect(l.x).toBeCloseTo(-r.x, 6);
    expect(r.x).toBeGreaterThan(0.04);
    expect(r.x).toBeLessThan(0.1);
    expect(l.z).toBeGreaterThan(0.15);
  });

  it('puts the mouth about where the 3D smile is, below the eyes and the nose', () => {
    const mouth = facePoint(100, 127), nose = facePoint(100, 111), eyes = facePoint(100, 95);
    expect(mouth.y).toBeGreaterThan(0.07);
    expect(mouth.y).toBeLessThan(0.13);
    expect(eyes.y).toBeGreaterThan(nose.y);
    expect(nose.y).toBeGreaterThan(mouth.y);
  });

  it('keeps the face in proportion: about the same size across as the head is wide', () => {
    const a = facePoint(100 - 38, 95), b = facePoint(100 + 38, 95);
    const width = b.x - a.x;
    expect(width).toBeGreaterThan(0.25);
    expect(width).toBeLessThan(HEAD.rx * 2 * 1.2);
  });

  it('floats just above the head everywhere, never inside it', () => {
    const g = facePatchGeometry();
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const d = (x / HEAD.rx) ** 2 + ((y - HEAD.cy) / HEAD.ry) ** 2 + (z / HEAD.rz) ** 2;
      expect(d).toBeGreaterThan(1);
      expect(d).toBeLessThan(1.06);
      expect(z).toBeGreaterThan(0); // on the front half
    }
  });

  it('covers the whole picture, with the picture the right way up', () => {
    const g = facePatchGeometry();
    const uv = g.getAttribute('uv'), pos = g.getAttribute('position');
    let top = 0, bottom = 0;
    for (let i = 0; i < uv.count; i++) { if (uv.getY(i) === 1) top = Math.max(top, pos.getY(i)); if (uv.getY(i) === 0) bottom = Math.max(bottom, pos.getY(i)); }
    expect(top).toBeGreaterThan(bottom); // picture top = top of the head
    expect(FACE_BOX.w).toBe(FACE_BOX.h);
  });
});
