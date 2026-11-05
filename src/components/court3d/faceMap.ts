import * as THREE from 'three';
import { FACE_VIEWBOX } from '../AvatarFace';

/**
 * Where the 2D avatar face goes on the 3D head.
 *
 * The face picture is a 104x104 window of the 200x200 avatar drawing (see FACE_VIEWBOX). This wraps that window
 * onto the front of the 3D head, which is an ellipsoid (see makeCharacter: centre y 0.2, radii 0.2, 0.228, 0.21).
 * One scale is used both ways, so the face keeps its proportions and the drawn head is about as big as the 3D one.
 * The eyes land at the height of the plain 3D eyes, the mouth where the plain 3D smile is.
 */
export const HEAD = { cy: 0.2, rx: 0.2, ry: 0.228, rz: 0.21 };

const [BOX_X0, BOX_Y0, BOX_W, BOX_H] = FACE_VIEWBOX.split(' ').map(Number);
export const FACE_BOX = { x0: BOX_X0, y0: BOX_Y0, w: BOX_W, h: BOX_H };

/** Metres of head surface for every unit of the 200x200 drawing. */
const METRES_PER_UNIT = 0.0045;
/** The eyes are at y = 95 in the drawing; this is the angle from the top of the head where the 3D eyes sit. */
const EYE_Y_2D = 95;
const EYE_THETA = (81 * Math.PI) / 180;
/** The picture floats just above the skin so it never z-fights with it. */
const LIFT = 1.012;

/** The point on the 3D head for a point of the 200x200 avatar drawing. */
export function facePoint(x2d: number, y2d: number): { x: number; y: number; z: number } {
  const theta = Math.min(Math.PI - 0.05, Math.max(0.05, EYE_THETA + ((y2d - EYE_Y_2D) * METRES_PER_UNIT) / HEAD.ry));
  const delta = Math.max(-1.45, Math.min(1.45, ((x2d - 100) * METRES_PER_UNIT) / HEAD.rx));
  const sinT = Math.sin(theta);
  const px = HEAD.rx * Math.sin(delta) * sinT;
  const py = HEAD.ry * Math.cos(theta);
  const pz = HEAD.rz * Math.cos(delta) * sinT;
  return { x: px * LIFT, y: HEAD.cy + py * LIFT, z: pz * LIFT };
}

let cached: THREE.BufferGeometry | null = null;

/** A curved patch over the front of the head with the face picture's coordinates. Shared by every character. */
export function facePatchGeometry(): THREE.BufferGeometry {
  if (cached) return cached;
  const N = 16;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const u = i / N, v = j / N;
      const p = facePoint(FACE_BOX.x0 + u * FACE_BOX.w, FACE_BOX.y0 + v * FACE_BOX.h);
      pos.push(p.x, p.y, p.z);
      // the head's own surface normal, so the picture is lit exactly like the skin around it
      const n = new THREE.Vector3(p.x / (HEAD.rx * HEAD.rx), (p.y - HEAD.cy) / (HEAD.ry * HEAD.ry), p.z / (HEAD.rz * HEAD.rz)).normalize();
      nor.push(n.x, n.y, n.z);
      uv.push(u, 1 - v);
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + (N + 1), d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  cached = g;
  return g;
}
