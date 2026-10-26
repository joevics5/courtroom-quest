import * as THREE from 'three';

/**
 * The courtroom, built from boxes. One fixed room, same layout every trial.
 * Coordinates are metres. The judge's bench is at the back wall (-z), the public gallery and the
 * entrance door at +z. Looking from the door toward the bench, +x is to the right: the
 * prosecution table is on the left, the defense table on the right, the witness box left of the
 * bench and the jury box along the right wall.
 */

export interface Spot {
  x: number;
  /** Height of the surface the person sits or stands on. */
  y: number;
  z: number;
  /** Direction they face: (sin yaw, cos yaw). 0 faces +z (the gallery), PI faces the bench. */
  yaw: number;
}

export interface Box2D { x0: number; x1: number; z0: number; z1: number }

export interface RoomInfo {
  judge: Spot;
  bailiff: Spot;
  prosecution: Spot[];
  defense: Spot[];
  witness: Spot;
  jury: Spot[];
  audience: Spot[];
  /** Where people enter and leave. */
  doors: { rear: Spot; chambers: Spot; side: Spot };
  /** Solid furniture the player cannot walk through. */
  obstacles: Box2D[];
  bounds: Box2D;
  /** Route points from the rear door up the aisle and through the gate. */
  gate: { x: number; z: number };
  /** Lamps, so the stage can dim or flicker them. */
  lights: THREE.PointLight[];
}

export const JURY_SEATS = 12;

function woodTexture(base: string, dark: string, planks: number, repeatX: number, repeatY: number) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const x = cv.getContext('2d')!;
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  const h = 256 / planks;
  for (let i = 0; i < planks; i++) {
    x.fillStyle = `rgba(0,0,0,${0.05 + ((i * 37) % 7) * 0.012})`;
    x.fillRect(0, i * h, 256, h);
    x.fillStyle = dark; x.fillRect(0, i * h, 256, 2);
    for (let g = 0; g < 7; g++) {
      x.strokeStyle = `rgba(0,0,0,${0.04 + ((g * 13 + i) % 5) * 0.012})`;
      x.beginPath(); const yy = i * h + 3 + ((g * 29 + i * 11) % Math.max(4, h - 5)); x.moveTo(0, yy); x.bezierCurveTo(80, yy + 2, 170, yy - 2, 256, yy + 1); x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, repeatY); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function haloTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const x = cv.getContext('2d')!; const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,225,170,1)'); g.addColorStop(0.4, 'rgba(255,200,120,.3)'); g.addColorStop(1, 'rgba(255,180,100,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20);

export function buildCourtroom(scene: THREE.Scene, opts: { shadows: boolean }): RoomInfo {
  const root = new THREE.Group(); scene.add(root);
  const mats = new Map<string, THREE.Material>();
  const lam = (c: number, key = String(c)) => { let m = mats.get(key); if (!m) mats.set(key, (m = new THREE.MeshLambertMaterial({ color: c }))); return m; };
  const floorTex = woodTexture('#8a5a33', '#4a2e18', 8, 8, 10);
  const panelTex = woodTexture('#5a3a22', '#2c1b0e', 4, 3, 1);
  const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
  const panelMat = new THREE.MeshLambertMaterial({ map: panelTex });
  const polished = new THREE.MeshLambertMaterial({ color: 0x6b4426 });
  const gold = new THREE.MeshLambertMaterial({ color: 0xc8923f, emissive: 0x3a2a08 });

  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, o: { cast?: boolean; recv?: boolean; parent?: THREE.Object3D } = {}) => {
    const mesh = new THREE.Mesh(BOX, m);
    mesh.scale.set(w, h, d); mesh.position.set(x, y, z);
    mesh.castShadow = o.cast ?? true; mesh.receiveShadow = o.recv ?? true;
    (o.parent || root).add(mesh);
    return mesh;
  };
  const cyl = (r: number, h: number, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(CYL, m); mesh.scale.set(r, h, r); mesh.position.set(x, y, z); mesh.castShadow = true; root.add(mesh); return mesh;
  };
  const obstacles: Box2D[] = [];
  const solid = (cx: number, cz: number, w: number, d: number) => obstacles.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });

  const X0 = -8, X1 = 8, Z0 = -10.5, Z1 = 11, WALL_H = 6.2;

  // floor, ceiling, walls
  box(X1 - X0, 0.2, Z1 - Z0, floorMat, 0, -0.1, (Z0 + Z1) / 2, { cast: false });
  box(X1 - X0, 0.2, Z1 - Z0, lam(0x3a2616), 0, WALL_H + 0.1, (Z0 + Z1) / 2, { cast: false });
  const plaster = lam(0xd9c8a6, 'plaster');
  box(X1 - X0, WALL_H, 0.3, plaster, 0, WALL_H / 2, Z0 - 0.15, { cast: false });
  box(X1 - X0, WALL_H, 0.3, plaster, 0, WALL_H / 2, Z1 + 0.15, { cast: false });
  box(0.3, WALL_H, Z1 - Z0, plaster, X0 - 0.15, WALL_H / 2, (Z0 + Z1) / 2, { cast: false });
  box(0.3, WALL_H, Z1 - Z0, plaster, X1 + 0.15, WALL_H / 2, (Z0 + Z1) / 2, { cast: false });
  // wood wainscot and trim
  box(X1 - X0, 2.2, 0.12, panelMat, 0, 1.1, Z0 + 0.06, { cast: false });
  box(X1 - X0, 2.2, 0.12, panelMat, 0, 1.1, Z1 - 0.06, { cast: false });
  box(0.12, 2.2, Z1 - Z0, panelMat, X0 + 0.06, 1.1, (Z0 + Z1) / 2, { cast: false });
  box(0.12, 2.2, Z1 - Z0, panelMat, X1 - 0.06, 1.1, (Z0 + Z1) / 2, { cast: false });
  box(X1 - X0, 0.14, 0.2, gold, 0, 2.25, Z0 + 0.1, { cast: false });
  box(0.2, 0.14, Z1 - Z0, gold, X0 + 0.1, 2.25, (Z0 + Z1) / 2, { cast: false });
  box(0.2, 0.14, Z1 - Z0, gold, X1 - 0.1, 2.25, (Z0 + Z1) / 2, { cast: false });
  // ceiling beams
  for (const z of [-7, -1, 5, 10]) box(X1 - X0, 0.35, 0.4, panelMat, 0, WALL_H - 0.17, z, { cast: false });

  // windows on both side walls
  const glass = new THREE.MeshBasicMaterial({ color: 0xcfe3f5 });
  for (const sx of [-1, 1]) for (const z of [-6, -0.5, 5, 9.5]) {
    box(0.06, 2.6, 1.3, glass, sx * (X1 - 0.12), 3.9, z, { cast: false, recv: false });
    box(0.1, 2.8, 1.5, gold, sx * (X1 - 0.16), 3.9, z, { cast: false, recv: false }).scale.x = 0.04;
    box(0.12, 0.08, 1.5, lam(0x3a2414), sx * (X1 - 0.17), 2.55, z, { cast: false });
  }

  // wall behind the bench: seal and flags
  const sealRing = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.06, 32), gold); sealRing.rotation.x = Math.PI / 2; sealRing.position.set(0, 4.3, Z0 + 0.12); root.add(sealRing);
  const sealIn = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.08, 32), lam(0x2a2f55)); sealIn.rotation.x = Math.PI / 2; sealIn.position.set(0, 4.3, Z0 + 0.14); root.add(sealIn);
  box(0.12, 0.8, 0.04, gold, 0, 4.3, Z0 + 0.2, { cast: false }); box(0.7, 0.1, 0.04, gold, 0, 4.45, Z0 + 0.2, { cast: false });
  for (const [fx, col] of [[-2.9, 0x1d3a6b], [2.9, 0x7a1d2a]] as const) {
    cyl(0.04, 3.6, gold, fx, 2.2, Z0 + 0.7);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide })); flag.position.set(fx + (fx < 0 ? 0.58 : -0.58), 3.5, Z0 + 0.7); root.add(flag);
    cyl(0.07, 0.14, gold, fx, 4.05, Z0 + 0.7);
  }

  // doors
  const doorM = lam(0x4a2d18);
  box(2.4, 3.1, 0.14, doorM, 0, 1.55, Z1 - 0.07, { cast: false }); box(0.04, 3.0, 0.16, gold, 0, 1.55, Z1 - 0.08, { cast: false });
  box(1.2, 2.7, 0.14, doorM, 4.6, 0.75 + 1.35, Z0 + 0.07, { cast: false });
  box(0.14, 2.7, 1.2, doorM, X0 + 0.07, 1.35, -4.4, { cast: false });
  box(0.14, 2.7, 1.2, doorM, X1 - 0.07, 1.35, 7.5, { cast: false });

  // floor rugs
  box(1.9, 0.02, 11.5, lam(0x6b1f2a), 0, 0.011, 5.2, { cast: false });
  box(10.5, 0.02, 7.4, lam(0x2b3d5c), 0, 0.011, -3.6, { cast: false });
  box(10.9, 0.025, 7.8, gold, 0, 0.006, -3.6, { cast: false });

  // judge's bench on a platform
  box(7.6, 0.75, 3.2, panelMat, 0, 0.375, -8.9);
  box(7.0, 0.85, 0.7, polished, 0, 0.75 + 0.425, -7.5);
  box(7.2, 0.08, 0.95, panelMat, 0, 0.75 + 0.89, -7.55);
  box(1.0, 0.24, 0.04, gold, 0, 0.75 + 0.5, -7.14, { cast: false });
  box(0.5, 0.12, 0.1, lam(0xd9b23c), -1.9, 0.75 + 0.99, -7.45, { cast: false });
  solid(0, -8.5, 7.6, 3.4);
  // judge's chair
  box(0.85, 0.12, 0.8, lam(0x2a1a14), 0, 0.75 + 0.42, -8.75);
  box(0.95, 1.5, 0.16, lam(0x3a1f16), 0, 0.75 + 1.1, -9.25);
  for (const sx of [-0.45, 0.45]) box(0.1, 0.4, 0.7, lam(0x2a1a14), sx, 0.75 + 0.62, -8.78);
  // steps to the platform
  box(1.4, 0.38, 0.5, panelMat, 4.4, 0.19, -7.2);

  // witness box (left of the bench)
  box(1.9, 0.4, 1.9, panelMat, -5.0, 0.2, -7.4);
  box(1.9, 0.9, 0.12, polished, -5.0, 0.4 + 0.45, -6.4);
  box(0.12, 0.9, 1.9, polished, -4.05, 0.4 + 0.45, -7.4);
  box(2.0, 0.08, 0.3, gold, -5.0, 0.4 + 0.92, -6.4, { cast: false });
  box(0.7, 0.55, 0.5, lam(0x2a1a14), -5.0, 0.4 + 0.3, -7.75);
  solid(-5.0, -7.4, 2.2, 2.2);

  // counsel tables and chairs
  const tableTop = lam(0x7a4e2c, 'tabletop');
  const chairM = lam(0x2a1a14, 'chair');
  const tables: [number, string][] = [[-3.2, 'p'], [3.2, 'd']];
  for (const [tx] of tables) {
    box(3.5, 0.08, 1.2, tableTop, tx, 0.86, -2.55);
    box(3.3, 0.8, 1.0, polished, tx, 0.4, -2.55);
    box(0.3, 0.02, 0.4, lam(0xf2efe8), tx - 0.7, 0.91, -2.4, { cast: false });
    box(0.3, 0.02, 0.4, lam(0xf2efe8), tx + 0.8, 0.91, -2.4, { cast: false });
    box(0.4, 0.03, 0.1, lam(0xd9b23c), tx, 0.91, -2.1, { cast: false });
    solid(tx, -2.55, 3.5, 1.3);
  }
  const counselChair = (x: number) => { box(0.62, 0.1, 0.6, chairM, x, 0.45, -1.46); box(0.62, 0.7, 0.1, chairM, x, 0.8, -1.2); box(0.08, 0.4, 0.08, chairM, x - 0.25, 0.2, -1.6); box(0.08, 0.4, 0.08, chairM, x + 0.25, 0.2, -1.6); box(0.08, 0.4, 0.08, chairM, x - 0.25, 0.2, -1.3); box(0.08, 0.4, 0.08, chairM, x + 0.25, 0.2, -1.3); };
  [-3.9, -2.5, 2.5, 3.9].forEach(counselChair);

  // jury box along the right wall, two tiers facing the room
  box(2.6, 0.18, 6.4, panelMat, 6.7, 0.09, -5.1);
  box(1.4, 0.45, 6.2, panelMat, 7.2, 0.225 + 0.18, -5.1);
  box(0.14, 0.95, 6.6, polished, 5.2, 0.48, -5.1);
  box(0.24, 0.08, 6.7, gold, 5.2, 0.98, -5.1, { cast: false });
  solid(6.6, -5.1, 3.2, 6.8);
  const jury: Spot[] = [];
  for (let i = 0; i < 6; i++) {
    const z = -7.5 + i * 0.95;
    jury.push({ x: 7.05, y: 0.55, z, yaw: -Math.PI / 2 }); // back row, higher
    box(0.55, 0.1, 0.6, chairM, 7.1, 0.55 + 0.45, z); box(0.1, 0.6, 0.6, chairM, 7.45, 0.55 + 0.8, z);
  }
  for (let i = 0; i < 6; i++) {
    const z = -7.5 + i * 0.95;
    jury.push({ x: 5.95, y: 0.18, z, yaw: -Math.PI / 2 });
    box(0.55, 0.1, 0.6, chairM, 6.0, 0.18 + 0.45, z); box(0.1, 0.55, 0.6, chairM, 6.35, 0.18 + 0.75, z);
  }

  // bar rail with a gate
  const rail = (x0: number, x1: number) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    box(w, 1.0, 0.14, polished, cx, 0.5, 2.7);
    box(w + 0.1, 0.07, 0.3, gold, cx, 1.03, 2.7, { cast: false });
    solid(cx, 2.7, w, 0.3);
  };
  rail(X0 + 0.1, -1.0); rail(1.0, X1 - 0.1);
  const gate = box(0.9, 0.9, 0.06, polished, -0.55, 0.45, 2.2); gate.rotation.y = -0.9;
  gate.position.set(-0.9 + Math.cos(0.9) * 0.45, 0.45, 2.7 + Math.sin(0.9) * 0.45);

  // public gallery pews
  const audience: Spot[] = [];
  const pewM = lam(0x6a4426, 'pew');
  for (let r = 0; r < 6; r++) {
    const z = 4.3 + r * 1.05;
    for (const [x0, x1] of [[-6.4, -1.3], [1.3, 6.4]]) {
      const cx = (x0 + x1) / 2, w = x1 - x0;
      box(w, 0.1, 0.55, pewM, cx, 0.45, z + 0.06);
      box(w, 0.9, 0.1, pewM, cx, 0.9, z + 0.38);
      box(0.1, 0.8, 0.7, pewM, x0, 0.4, z + 0.1); box(0.1, 0.8, 0.7, pewM, x1, 0.4, z + 0.1);
    }
    for (const x of [-5.8, -4.8, -3.8, -2.8, -1.9, 1.9, 2.8, 3.8, 4.8, 5.8]) audience.push({ x, y: 0, z, yaw: Math.PI });
  }
  solid(-3.85, 6.9, 5.3, 6.1); solid(3.85, 6.9, 5.3, 6.1);

  // pendant lamps
  const lights: THREE.PointLight[] = [];
  const halo = haloTexture();
  const lampSpots: [number, number, boolean][] = [[-3.5, -3, true], [3.5, -3, true], [-3.5, 5, true], [3.5, 5, true], [-3.5, 9.5, false], [3.5, 9.5, false]];
  for (const [lx, lz, lit] of lampSpots) {
    cyl(0.015, 1.4, lam(0x222222), lx, WALL_H - 0.7, lz);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.3, 16, 1, true), new THREE.MeshLambertMaterial({ color: 0x1f3b2a, side: THREE.DoubleSide })); shade.position.set(lx, WALL_H - 1.5, lz); root.add(shade);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); spr.scale.set(1.6, 1.6, 1); spr.position.set(lx, WALL_H - 1.7, lz); root.add(spr);
    if (lit) { const pl = new THREE.PointLight(0xffd9a0, 22, 14, 1.6); pl.position.set(lx, WALL_H - 1.9, lz); root.add(pl); lights.push(pl); }
  }

  // general lighting
  scene.add(new THREE.HemisphereLight(0xfff0d8, 0x3a2a20, 0.9));
  const sun = new THREE.DirectionalLight(0xfff2dc, 1.1);
  sun.position.set(-5, 11, 9); sun.target.position.set(0, 0, -2);
  if (opts.shadows) {
    sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536);
    const c = sun.shadow.camera; c.left = -12; c.right = 12; c.top = 12; c.bottom = -12; c.near = 1; c.far = 30; sun.shadow.bias = -0.0008; sun.shadow.radius = 3;
  }
  scene.add(sun, sun.target);

  const sp = (x: number, y: number, z: number, yaw: number): Spot => ({ x, y, z, yaw });
  return {
    judge: sp(0, 0.75, -8.62, 0),
    bailiff: sp(-6.2, 0, -3.7, 0.55),
    prosecution: [sp(-2.5, 0, -1.5, Math.PI), sp(-3.9, 0, -1.5, Math.PI)],
    defense: [sp(2.5, 0, -1.5, Math.PI), sp(3.9, 0, -1.5, Math.PI)],
    witness: sp(-5.0, 0.4, -7.3, 0.75),
    jury,
    audience,
    doors: { rear: sp(0, 0, 10.2, Math.PI), chambers: sp(4.6, 0.75, -9.9, Math.PI), side: sp(-7.4, 0, -4.4, Math.PI / 2) },
    obstacles,
    bounds: { x0: -7.5, x1: 7.5, z0: -9.4, z1: 10.6 },
    gate: { x: 0, z: 2.7 },
    lights
  };
}
