import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { avatarFromSeed } from '../../lib/avatars';
import { applyFace, lookFromAvatar, makeCharacter, pose } from './character';

const a = { ...avatarFromSeed('Test Person', 'counsel'), beard: 'full' as const, glasses: true, gender: 'male' as const };

describe('real avatar face on a 3D character', () => {
  it('hides the plain 3D face bits and shows the picture', () => {
    const c = makeCharacter(lookFromAvatar(a, 'counsel'));
    expect(c.face).toBeNull();
    expect(c.faceParts.length).toBeGreaterThanOrEqual(2 + 2 + 1 + 1 + 3); // eyes, brows, smile, beard, glasses
    c.faceParts.forEach(p => expect(p.visible).toBe(true));
    applyFace(c, new THREE.Texture(), new THREE.Texture());
    c.faceParts.forEach(p => expect(p.visible).toBe(false));
    expect(c.face).not.toBeNull();
    expect(c.H.children.some(o => (o as THREE.Mesh).material === c.face!.mat)).toBe(true);
  });

  it('is only put on once', () => {
    const c = makeCharacter(lookFromAvatar(a, 'counsel'));
    applyFace(c, new THREE.Texture(), new THREE.Texture());
    const first = c.face;
    applyFace(c, new THREE.Texture(), new THREE.Texture());
    expect(c.face).toBe(first);
  });

  it('shows the open-mouth picture while talking and the closed one otherwise', () => {
    const c = makeCharacter(lookFromAvatar(a, 'counsel'));
    const neutral = new THREE.Texture(), talk = new THREE.Texture();
    applyFace(c, neutral, talk);
    for (let i = 0; i < 40; i++) pose(c, 'idle', 0.05, 0, i * 0.05);
    expect(c.face!.mat.map).toBe(neutral);
    let sawOpen = false;
    for (let i = 0; i < 80; i++) { pose(c, 'talk', 0.05, 0, 2 + i * 0.05); if (c.face!.mat.map === talk) sawOpen = true; }
    expect(sawOpen).toBe(true);
    for (let i = 0; i < 80; i++) pose(c, 'idle', 0.05, 0, 6 + i * 0.05);
    expect(c.face!.mat.map).toBe(neutral);
  });

  it('a character without a face loaded animates exactly as before', () => {
    const c = makeCharacter(lookFromAvatar(a, 'juror'));
    for (let i = 0; i < 60; i++) pose(c, 'talk', 0.05, 0, i * 0.05);
    expect(c.face).toBeNull();
    expect(c.smile.visible || c.mouth.visible).toBe(true);
  });
});
