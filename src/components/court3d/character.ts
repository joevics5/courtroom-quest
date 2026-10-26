import * as THREE from 'three';
import { ACCENT_COLORS, ATTIRE_COLORS, HAIR_COLORS, SKIN_TONES, type AvatarConfig } from '../../lib/avatars';

/**
 * Procedural 3D people. Soft ellipsoid bodies, a layered walk, blinking, breathing, gaze,
 * speaking gestures and a sit/stand blend. No models to download.
 */

export type HairStyle3D = 'short' | 'buzz' | 'curly' | 'afro' | 'long' | 'bun' | 'bob' | 'wig' | 'bald';

export interface Look {
  skin: number;
  hair: number;
  hairStyle: HairStyle3D;
  shirt: number;
  pants: number;
  accent: number;
  woman: boolean;
  beard: boolean;
  glasses: boolean;
  /** Long black robe (judge). */
  robe: boolean;
  /** Tan uniform with badge (bailiff). */
  uniform: boolean;
  /** Body height multiplier. */
  height: number;
}

const hex = (s: string) => parseInt(s.replace('#', ''), 16);

/** Turns the game's avatar settings into a 3D look, so a person keeps their face from the 2D screens. */
export function lookFromAvatar(a: AvatarConfig, role: 'judge' | 'counsel' | 'bailiff' | 'witness' | 'juror' | 'public' = 'public'): Look {
  const hairStyle: HairStyle3D =
    a.hairStyle === 'slick' ? 'short' : a.hairStyle === 'bald' ? 'bald' : (a.hairStyle as HairStyle3D);
  const attire = hex(ATTIRE_COLORS[a.attireColor % ATTIRE_COLORS.length]);
  const judge = role === 'judge';
  const bailiff = role === 'bailiff';
  return {
    skin: hex(SKIN_TONES[a.skin % SKIN_TONES.length]),
    hair: a.hairStyle === 'wig' || judge && a.age === 2 ? 0xe8e4dc : hex(HAIR_COLORS[a.hairColor % HAIR_COLORS.length]),
    hairStyle,
    shirt: judge ? 0x15151b : bailiff ? 0xcdb88a : attire,
    pants: judge ? 0x15151b : bailiff ? 0x2a3328 : 0x1f2230,
    accent: hex(ACCENT_COLORS[a.accent % ACCENT_COLORS.length]),
    woman: a.gender === 'female',
    beard: a.beard !== 'none',
    glasses: a.glasses,
    robe: judge,
    uniform: bailiff,
    height: a.gender === 'female' ? 0.96 : 1.0
  };
}

export type PoseName = 'idle' | 'talk' | 'walk' | 'desk' | 'lap' | 'attention' | 'gavel' | 'wave';

export interface Character {
  g: THREE.Group;
  b: THREE.Group;
  P: THREE.Group;
  C: THREE.Group;
  H: THREE.Group;
  lL: { p: THREE.Group; k: THREE.Group };
  lR: { p: THREE.Group; k: THREE.Group };
  aL: { p: THREE.Group; k: THREE.Group };
  aR: { p: THREE.Group; k: THREE.Group };
  eyes: { lid: THREE.Mesh; pu: THREE.Mesh }[];
  brows: THREE.Mesh[];
  smile: THREE.Mesh;
  mouth: THREE.Mesh;
  gavelProp: THREE.Group;
  label: THREE.Sprite | null;
  /** Walk cycle phase and random per-person offset. */
  ph: number;
  po: number;
  /** Sit amount, 0 standing .. 1 seated, and where it is heading. */
  sa: number;
  sitTarget: number;
  wk: number;
  look: THREE.Vector3 | null;
  nb: number;
  bt: number;
  hy: number;
  hp: number;
  mood: number;
  moodT: number;
  mo: number;
  gavelT: number;
  height: number;
  s: Record<string, number>;
}

const SPHERE = new THREE.SphereGeometry(1, 18, 14);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
const CONE = new THREE.CylinderGeometry(0, 1, 1, 16);
const SHADOW_GEO = new THREE.CircleGeometry(0.45, 14);
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.28, depthWrite: false });
const SMILE_GEO = new THREE.TorusGeometry(0.045, 0.007, 5, 12, Math.PI);

const lam = new Map<number, THREE.MeshLambertMaterial>();
const bas = new Map<number, THREE.MeshBasicMaterial>();
export const M = (c: number) => {
  let m = lam.get(c);
  if (!m) lam.set(c, (m = new THREE.MeshLambertMaterial({ color: c })));
  return m;
};
export const MB = (c: number) => {
  let m = bas.get(c);
  if (!m) bas.set(c, (m = new THREE.MeshBasicMaterial({ color: c })));
  return m;
};

function put(p: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, shadow = true) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  o.castShadow = shadow;
  p.add(o);
  return o;
}
const el = (p: THREE.Object3D, rx: number, ry: number, rz: number, c: number, x = 0, y = 0, z = 0, m?: THREE.Material, shadow = true) =>
  put(p, SPHERE, m || M(c), x, y, z, rx, ry, rz, shadow);
const bx = (p: THREE.Object3D, w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0, m?: THREE.Material) =>
  put(p, BOX, m || M(c), x, y, z, w, h, d);
const cy = (p: THREE.Object3D, r: number, h: number, c: number, x = 0, y = 0, z = 0) => put(p, CYL, M(c), x, y, z, r, h, r);
const cn = (p: THREE.Object3D, r: number, h: number, c: number, x = 0, y = 0, z = 0) => put(p, CONE, M(c), x, y, z, r, h, r);

export function makeCharacter(o: Look): Character {
  const g = new THREE.Group();
  const b = new THREE.Group();
  g.add(b);
  const wm = o.woman;
  const sk = o.skin, sh = o.shirt, pn = o.pants, hc = o.hair, st = o.hairStyle;
  const P = new THREE.Group(); P.position.set(0, 0.9, 0); b.add(P);
  const C = new THREE.Group(); C.position.set(0, 0.96, 0); b.add(C);
  const H = new THREE.Group(); H.position.set(0, 0.56, 0); C.add(H);

  el(P, wm ? 0.19 : 0.17, 0.15, 0.125, pn, 0, 0.03, 0);
  if (o.robe) cn(P, 0.36, 1.0, sh, 0, -0.44, 0);
  el(C, wm ? 0.2 : 0.235, 0.3, wm ? 0.13 : 0.15, sh, 0, 0.27, 0);
  el(C, wm ? 0.15 : 0.17, 0.16, 0.115, sh, 0, 0.04, 0);
  cy(C, 0.05, 0.12, sk, 0, 0.5, 0);
  if (o.robe) {
    bx(C, 0.1, 0.34, 0.03, 0xf2efe8, 0, 0.36, 0.14); // white jabot
  } else if (o.uniform) {
    el(C, 0.035, 0.035, 0.015, 0xd9b23c, 0.1, 0.4, 0.145, MB(0xd9b23c)); // badge
    bx(C, 0.04, 0.22, 0.02, 0x2a2f28, 0, 0.3, 0.14); // tie
  } else if (!wm) {
    bx(C, 0.045, 0.24, 0.02, o.accent, 0, 0.3, 0.14); // tie
  } else {
    el(C, 0.07, 0.03, 0.02, o.accent, 0, 0.43, 0.12); // scarf
  }

  // head
  el(H, 0.2, 0.228, 0.21, sk, 0, 0.2, 0);
  el(H, 0.035, 0.05, 0.025, sk, -0.2, 0.2, 0);
  el(H, 0.035, 0.05, 0.025, sk, 0.2, 0.2, 0);
  el(H, 0.03, 0.04, 0.035, sk, 0, 0.18, 0.2);
  const eyes: Character['eyes'] = [];
  [-1, 1].forEach(sd => {
    const e = new THREE.Group(); e.position.set(sd * 0.082, 0.235, 0.178); H.add(e);
    el(e, 0.046, 0.05, 0.03, 0xf4f0ea, 0, 0, 0, undefined, false);
    const pu = el(e, 0.022, 0.027, 0.012, 0x1a1010, 0, 0, 0.026, MB(0x1a1010), false);
    const lid = el(e, 0.052, 0.056, 0.036, sk, 0, 0, 0.004, undefined, false);
    lid.scale.y = 0.001;
    eyes.push({ lid, pu });
  });
  const brows = [-1, 1].map(sd => bx(H, 0.08, 0.016, 0.02, hc, sd * 0.082, 0.315, 0.185) as THREE.Mesh);
  const smile = new THREE.Mesh(SMILE_GEO, MB(0x7a3a3a));
  smile.position.set(0, 0.105, 0.2); smile.rotation.z = Math.PI; H.add(smile);
  const mouth = el(H, 0.04, 0.03, 0.02, 0x4a1a1a, 0, 0.1, 0.2, MB(0x4a1a1a), false); mouth.visible = false;

  // hair
  if (st !== 'bald') {
    el(H, 0.215, st === 'buzz' ? 0.11 : 0.165, 0.225, hc, 0, 0.285, -0.04);
    if (st === 'long') { bx(H, 0.4, 0.55, 0.12, hc, 0, -0.03, -0.17); bx(H, 0.05, 0.38, 0.17, hc, -0.19, 0.08, -0.05); bx(H, 0.05, 0.38, 0.17, hc, 0.19, 0.08, -0.05); }
    if (st === 'bob') { bx(H, 0.4, 0.3, 0.14, hc, 0, 0.06, -0.15); bx(H, 0.05, 0.26, 0.2, hc, -0.19, 0.12, -0.04); bx(H, 0.05, 0.26, 0.2, hc, 0.19, 0.12, -0.04); }
    if (st === 'bun') el(H, 0.1, 0.1, 0.1, hc, 0, 0.5, -0.1);
    if (st === 'afro') el(H, 0.28, 0.28, 0.27, hc, 0, 0.3, -0.13);
    if (st === 'curly') for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; el(H, 0.085, 0.085, 0.085, hc, Math.cos(a) * 0.17, 0.4 + Math.sin(i * 2) * 0.02, Math.sin(a) * 0.17 - 0.05); }
    if (st === 'wig') { for (let i = -2; i <= 2; i++) { el(H, 0.07, 0.07, 0.07, hc, -0.2, 0.1 - i * 0.07, -0.04); el(H, 0.07, 0.07, 0.07, hc, 0.2, 0.1 - i * 0.07, -0.04); } bx(H, 0.38, 0.4, 0.12, hc, 0, 0.12, -0.17); }
  }
  if (o.beard) el(H, 0.15, 0.085, 0.11, hc, 0, 0.04, 0.1);
  if (o.glasses) { bx(H, 0.3, 0.015, 0.015, 0x222222, 0, 0.235, 0.205); bx(H, 0.1, 0.075, 0.012, 0x222222, -0.082, 0.235, 0.205); bx(H, 0.1, 0.075, 0.012, 0x222222, 0.082, 0.235, 0.205); }

  const sx = wm ? 0.23 : 0.29;
  const sleeve = o.robe ? sh : sh;
  const arm = (sd: number) => {
    const p = new THREE.Group(); p.position.set(sd * sx, 0.42, 0); C.add(p);
    el(p, 0.085, 0.085, 0.085, sleeve, 0, 0, 0);
    el(p, o.robe ? 0.1 : 0.07, 0.17, o.robe ? 0.1 : 0.07, sleeve, 0, -0.15, 0);
    const k = new THREE.Group(); k.position.set(0, -0.31, 0); p.add(k);
    el(k, o.robe ? 0.085 : 0.06, 0.16, o.robe ? 0.085 : 0.06, o.robe ? sh : sk, 0, -0.14, 0);
    el(k, 0.056, 0.056, 0.056, sk, 0, -0.31, 0);
    return { p, k };
  };
  const leg = (sd: number) => {
    const p = new THREE.Group(); p.position.set(sd * 0.1, 0, 0); P.add(p);
    el(p, 0.105, 0.235, 0.105, pn, 0, -0.2, 0);
    const k = new THREE.Group(); k.position.set(0, -0.43, 0); p.add(k);
    el(k, 0.078, 0.225, 0.078, pn, 0, -0.2, 0);
    el(k, 0.07, 0.05, 0.13, 0x1a1a1a, 0, -0.43, 0.05);
    return { p, k };
  };

  const aR = arm(1);
  const gavelProp = new THREE.Group();
  cy(gavelProp, 0.012, 0.18, 0x6b4a2b, 0, -0.04, 0);
  const head = cy(gavelProp, 0.035, 0.1, 0x6b4a2b, 0, 0.06, 0); head.rotation.z = Math.PI / 2;
  gavelProp.position.set(0, -0.36, 0.03); gavelProp.rotation.x = 0.4; gavelProp.visible = false;
  aR.k.add(gavelProp);

  const c: Character = {
    g, b, P, C, H, lL: leg(-1), lR: leg(1), aL: arm(-1), aR, eyes, brows, smile, mouth, gavelProp, label: null,
    ph: Math.random() * 6, po: Math.random() * 6, sa: 0, sitTarget: 0, wk: 0, look: null,
    nb: 1 + Math.random() * 3, bt: 0, hy: 0, hp: 0, mood: 0.1, moodT: 0.1, mo: 0, gavelT: -1, height: o.height,
    s: { al: 0, ar: 0, alz: -0.06, arz: 0.06, el: -0.1, er: -0.1, hpS: 0, lean: 0, cy: 0 }
  };
  g.scale.setScalar(o.height * (1 + (Math.random() - 0.5) * 0.04));
  const sh2 = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
  sh2.position.y = 0.03; sh2.rotation.x = -Math.PI / 2; g.add(sh2);
  return c;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/** World position of the head, for cameras and gaze. */
export function headPos(c: Character, out = new THREE.Vector3()): THREE.Vector3 {
  c.g.updateWorldMatrix(true, false);
  out.set(0, 1.72 - 0.46 * c.sa, 0);
  return c.g.localToWorld(out);
}

/**
 * Animate a person for one frame. `st` is what they are doing, `dist` how far they walked this frame.
 * Layers: pose targets (smoothed), walk cycle (added on top), breathing, head gaze, blinking, face.
 */
export function pose(c: Character, st: PoseName, dt: number, dist: number, t: number) {
  const s = c.s, po = c.po;
  const k = 1 - Math.exp(-dt * 9), kt = 1 - Math.exp(-dt * 5), kh = 1 - Math.exp(-dt * 7);
  const sm = (n: string, v: number, kk = k) => { s[n] += (v - s[n]) * kk; };
  c.sa += (c.sitTarget - c.sa) * (1 - Math.exp(-dt * 6));
  const sa = c.sa;
  const spd = dt > 0 ? dist / dt : 0;
  const walking = st === 'walk' && sa < 0.2;
  c.wk += ((walking ? 1 : 0) - c.wk) * (1 - Math.exp(-dt * 8));
  if (walking) c.ph += dist * 2.5;
  const wk = c.wk, sn = Math.sin(c.ph), cs = Math.cos(c.ph), amp = Math.min(0.8, 0.36 + spd * 0.13) * wk;

  let al = 0.04 + Math.sin(t * 0.8 + po) * 0.03, ar = 0.04 + Math.sin(t * 0.9 + po * 2) * 0.03, alz = -0.07, arz = 0.07, el2 = -0.12, er = -0.12;
  let hpS = 0, lean = 0, cyaw = 0, mo = 0;
  let gavel = false;
  if (st === 'talk') {
    const ge = clamp(0.5 + 0.9 * Math.sin(t * 0.55 + po * 1.7), 0, 1), n1 = Math.sin(t * 2.3 + po) * Math.sin(t * 0.9 + po * 2), n2 = Math.sin(t * 3.1 + po * 3);
    ar = -0.3 - 0.5 * ge + n1 * 0.25 * ge; er = -0.5 - 0.8 * ge + n2 * 0.3 * ge; arz = 0.1 + 0.25 * ge;
    const ge2 = Math.max(0, Math.sin(t * 0.43 + po * 2.3));
    al = -0.2 * ge2 + Math.sin(t * 2.1 + po) * 0.12 * ge2; el2 = -0.3 - 0.7 * ge2; alz = -0.1 - 0.15 * ge2;
    mo = Math.max(0, Math.abs(Math.sin(t * 10 + po * 3)) * (0.55 + 0.45 * Math.sin(t * 3.3 + po))) * (Math.sin(t * 1.9 + po) > -0.55 ? 1 : 0);
    hpS = Math.sin(t * 3.1 + po) * 0.035; cyaw = Math.sin(t * 0.9 + po) * 0.12; lean = 0.03;
  } else if (st === 'desk') {
    al = -0.75 + Math.sin(t * 0.7 + po) * 0.03; ar = -0.75 + Math.sin(t * 0.9 + po) * 0.04 + Math.max(0, Math.sin(t * 1.3 + po * 2)) * 0.05;
    el2 = -1.15; er = -1.15 + Math.sin(t * 2.2 + po) * 0.04; alz = -0.05; arz = 0.05; lean = 0.1; hpS = 0.05;
  } else if (st === 'lap') {
    al = -0.5; ar = -0.5; el2 = -1.2; er = -1.2; alz = 0.08; arz = -0.08; hpS = 0.02; lean = 0.02;
  } else if (st === 'attention') {
    al = 0.02; ar = 0.02; alz = -0.04; arz = 0.04; el2 = -0.05; er = -0.05; lean = -0.02;
  } else if (st === 'gavel') {
    gavel = true;
    const u = c.gavelT >= 0 ? c.gavelT : 0;
    const strike = Math.max(0, Math.sin(u * 14)) * (u < 1.2 ? 1 : 0);
    ar = -1.0 - strike * 0.9; er = -1.2 - strike * 0.3; arz = 0.1; al = -0.3; el2 = -0.8; lean = 0.03 + strike * 0.05;
  } else if (st === 'wave') { arz = 2.4 + Math.sin(t * 7) * 0.35; er = -0.3; }
  c.gavelT = gavel ? (c.gavelT < 0 ? 0 : c.gavelT + dt) : -1;

  sm('al', al); sm('ar', ar); sm('alz', alz); sm('arz', arz); sm('el', el2); sm('er', er); sm('hpS', hpS, kh); sm('lean', lean, kt); sm('cy', cyaw, kt);

  const wtl = sn * amp, wtr = -sn * amp, wkl = Math.max(0, -cs) * 0.95 * wk, wkr = Math.max(0, cs) * 0.95 * wk;
  const wal = -sn * amp * 0.75, war = sn * amp * 0.75;
  const wel = -0.15 * wk - Math.max(0, -wal) * 0.45, wer = -0.15 * wk - Math.max(0, -war) * 0.45;
  // sitting: thighs forward, knees bent, body lowered
  const sitThigh = -1.5 * sa, sitKnee = 1.55 * sa;
  c.lL.p.rotation.x = sitThigh + wtl; c.lR.p.rotation.x = sitThigh + wtr;
  c.lL.k.rotation.x = sitKnee + wkl + 0.05; c.lR.k.rotation.x = sitKnee + wkr + 0.05;
  c.aL.p.rotation.x = s.al + wal; c.aR.p.rotation.x = s.ar + war;
  c.aL.p.rotation.z = s.alz; c.aR.p.rotation.z = s.arz;
  c.aL.k.rotation.x = s.el + wel; c.aR.k.rotation.x = s.er + wer;

  const idle = 1 - wk, sway = Math.sin(t * 0.35 + po) * 0.02 * idle;
  c.P.rotation.y = sn * 0.17 * wk + Math.sin(t * 0.5 + po) * 0.03 * idle;
  c.C.rotation.y = -sn * 0.22 * wk + s.cy;
  c.C.rotation.x = 0.07 * wk * Math.min(1, spd / 1.5 + 0.3) + s.lean;
  c.C.scale.y = 1 + Math.sin(t * 1.9 + po) * 0.012;
  c.b.rotation.z = sn * 0.04 * wk + sway;
  const by = Math.cos(c.ph * 2) * 0.03 * wk - 0.46 * sa;
  c.b.position.y += (by - c.b.position.y) * Math.min(1, dt * 20);

  // gaze
  let hyT = 0, hpT = s.hpS;
  if (c.look) {
    const p = c.g.position;
    const wp = new THREE.Vector3(); c.g.getWorldPosition(wp);
    const dx = c.look.x - wp.x, dz = c.look.z - wp.z, hd = Math.sqrt(dx * dx + dz * dz) || 1;
    const yawW = c.g.getWorldDirection(new THREE.Vector3());
    const facing = Math.atan2(yawW.x, yawW.z);
    hyT = clamp(wrap(Math.atan2(dx, dz) - facing - c.C.rotation.y - c.P.rotation.y * 0.5), -0.95, 0.95);
    hpT += clamp(Math.atan2(1.72 - c.look.y, hd) * 0.8, -0.3, 0.35);
    void p;
  } else {
    hyT = Math.sin(t * 0.3 + po) * 0.28 * Math.sin(t * 0.11 + po * 2) - sn * 0.05 * wk;
  }
  c.hy += (hyT - c.hy) * kh; c.hp += (hpT - c.hp) * kh;
  c.H.rotation.y = c.hy - c.C.rotation.y * 0.5;
  c.H.rotation.x = c.hp - c.C.rotation.x * 0.6;
  c.H.rotation.z = Math.sin(t * 0.6 + po) * 0.025 - c.b.rotation.z * 0.6;

  // blink + eyes
  c.nb -= dt; if (c.nb < 0) { c.bt = 0.15; c.nb = 1.8 + Math.random() * 4.2; }
  let bl = 0; if (c.bt > 0) { c.bt -= dt; bl = Math.sin(clamp(1 - c.bt / 0.15, 0, 1) * Math.PI); }
  const ex = clamp(c.hy * 0.02, -0.015, 0.015);
  for (const e of c.eyes) { e.lid.scale.y = Math.max(0.001, 0.058 * bl); e.pu.position.x = ex; }

  // face
  c.mood += (c.moodT - c.mood) * Math.min(1, dt * 3);
  const m = c.mood;
  c.mo += (mo - c.mo) * Math.min(1, dt * 18);
  c.mouth.visible = c.mo > 0.1; c.mouth.scale.y = 0.012 + c.mo * 0.04; c.smile.visible = c.mo < 0.35;
  c.smile.rotation.z = m >= 0 ? Math.PI : 0; c.smile.scale.y = 0.2 + Math.abs(m) * 0.9; c.smile.position.y = m >= 0 ? 0.112 : 0.095;
  const dn = Math.max(0, -m);
  c.brows[0].position.y = c.brows[1].position.y = 0.315 + m * 0.012;
  c.brows[0].rotation.z = -dn * 0.35; c.brows[1].rotation.z = dn * 0.35;
  c.gavelProp.visible = gavel;
}

/** Small floating card above a head (e.g. a juror's vote). */
export function makeLabel(text: string, bg: string): THREE.Sprite {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 72;
  const x = cv.getContext('2d')!;
  x.fillStyle = bg; x.beginPath(); x.roundRect(4, 4, 248, 64, 18); x.fill();
  x.fillStyle = '#fff'; x.font = '700 34px system-ui, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 38);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
  sp.scale.set(1.15, 0.32, 1); sp.renderOrder = 20;
  return sp;
}
