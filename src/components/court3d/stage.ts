import * as THREE from 'three';
import { randomAvatar, type AvatarConfig } from '../../lib/avatars';
import type { StageSpeaker } from '../../lib/stageSpeaker';
import { headPos, lookFromAvatar, makeCharacter, makeLabel, pose, type Character, type PoseName } from './character';
import { buildCourtroom, type Box2D, type RoomInfo, type Spot } from './room';

export type ShotName = 'wide' | 'judge' | 'prosecution' | 'defense' | 'witness' | 'jury' | 'audience' | 'bailiff' | 'player';

export interface Person { name: string; avatar: AvatarConfig }
export interface StageInput {
  mode: 'pretrial' | 'trial';
  judge: Person;
  prosecution: Person;
  defense: Person;
  bailiff?: Person;
  playerRole?: 'prosecution' | 'defense';
  active: StageSpeaker;
  talking: boolean;
  /** Explicit camera shot. Null/undefined: follow the active speaker. */
  shot?: ShotName | null;
  witness?: Person | null;
  jurors: { id: string; name?: string }[];
  jurorVotes?: Record<string, 'GUILTY' | 'NOT_GUILTY'>;
  audience: number;
  /** Pre-trial: the player pressed Start. */
  begun: boolean;
}

export interface StageEvents {
  onSeated?: () => void;
  onJudgeSeated?: () => void;
  onFocus?: (who: string) => void;
}

interface Mover { c: Character; path: THREE.Vector3[]; speed: number; yaw: number | null; done?: () => void }
interface Task { at: number; fn: () => void }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * The 3D courtroom. Owns the renderer, the room and everyone in it. React hands it plain
 * state (StageInput) and it animates toward it: who stands, who talks, where the camera looks.
 */
export class CourtStage {
  readonly scene = new THREE.Scene();
  readonly cam = new THREE.PerspectiveCamera(50, 1.6, 0.1, 80);
  readonly room: RoomInfo;
  private renderer: THREE.WebGLRenderer;
  private raf = 0;
  private last = 0;
  private time = 0;
  private running = true;
  private disposed = false;

  private input!: StageInput;
  private keyOf = '';
  private judge!: Character;
  private bailiff!: Character;
  private counsel: Record<'prosecution' | 'defense', Character> = {} as never;
  private witnessC: Character | null = null;
  private witnessKey = '';
  private jurors = new Map<string, Character>();
  private jurorKey = '';
  private audience: Character[] = [];
  private audKey = '';
  private movers: Mover[] = [];
  private tasks: Task[] = [];
  private labels: THREE.Sprite[] = [];
  private everyone: Character[] = [];

  // player control (pre-trial)
  private player: Character | null = null;
  private playerPos = V();
  private playerYaw = Math.PI;
  private playerState: 'walking' | 'sitting' | 'seated' | 'none' = 'none';
  private auto: THREE.Vector3[] = [];
  private joy = { x: 0, y: 0 };
  private keys: Record<string, boolean> = {};
  private orbit = 0;
  private marker: THREE.Group;
  private entranceStarted = false;
  private judgeSeatedOnce = false;
  private rise = false;

  // camera
  private camPos = V(0, 4.6, 10.3);
  private camLook = V(0, 1, -3);
  private camFov = 62;
  private shotName: string = 'wide';
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private w = 1; private h = 1;

  constructor(private canvas: HTMLCanvasElement, private ev: StageEvents = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x120d14);
    this.room = buildCourtroom(this.scene, { shadows: true });
    this.marker = this.buildMarker();
    this.scene.add(this.marker);
    this.bindInput();
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------------ public API
  /** Hand the stage the latest game state. Cheap to call on every render. */
  set(input: StageInput) {
    const first = !this.input;
    const prev = this.input;
    this.input = input;
    const key = [input.mode, input.playerRole, avKey(input.judge), avKey(input.prosecution), avKey(input.defense), input.bailiff ? avKey(input.bailiff) : ''].join('|');
    if (key !== this.keyOf) { this.keyOf = key; this.buildCast(first || !prev || prev.mode !== input.mode); }
    this.syncAudience();
    this.syncJurors();
    this.syncWitness();
    if (input.begun && !this.entranceStarted && input.mode === 'pretrial') this.startEntrance();
  }

  setJoystick(x: number, y: number) { this.joy.x = x; this.joy.y = y; if (Math.hypot(x, y) > 0.12) this.auto = []; }
  /** Walk the player to their chair along the aisle and through the gate. */
  autoWalkToSeat() {
    if (this.playerState !== 'walking' || !this.player) return;
    const seat = this.seatSpot();
    const p = this.playerPos;
    const pts: THREE.Vector3[] = [];
    if (p.z > this.room.gate.z + 0.2) { if (Math.abs(p.x) > 0.6) pts.push(V(0, 0, Math.max(p.z, 4))); pts.push(V(0, 0, this.room.gate.z + 0.5)); }
    pts.push(V(seat.x, 0, 0.1), V(seat.x, 0, seat.z + 0.1));
    this.auto = pts;
  }
  get seated() { return this.playerState === 'seated'; }
  get playerSeat(): Spot { return this.seatSpot(); }
  focusName() { return this.shotName; }

  resize() {
    const w = this.canvas.clientWidth || 640, h = this.canvas.clientHeight || 400;
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }
  setRunning(on: boolean) { this.running = on; if (on) this.last = 0; }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unbind?.();
    this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.material) { const mats = Array.isArray(m.material) ? m.material : [m.material]; mats.forEach(x => { (x as THREE.MeshLambertMaterial).map?.dispose(); }); } });
    this.renderer.dispose();
    try { this.renderer.forceContextLoss(); } catch { /* already gone */ }
  }

  // ------------------------------------------------------------------ building people
  private mk(p: Person, role: Parameters<typeof lookFromAvatar>[1]) { const c = makeCharacter(lookFromAvatar(p.avatar, role)); this.everyone.push(c); return c; }
  private drop(c: Character | null | undefined) { if (!c) return; this.scene.remove(c.g); this.everyone = this.everyone.filter(x => x !== c); this.movers = this.movers.filter(m => m.c !== c); }
  private place(c: Character, s: Spot, sit: boolean) {
    c.g.position.set(s.x, s.y, s.z); c.g.rotation.y = s.yaw; c.sitTarget = sit ? 1 : 0; c.sa = sit ? 1 : 0;
    this.scene.add(c.g);
  }
  private seatSpot(): Spot { return (this.input?.playerRole === 'prosecution' ? this.room.prosecution : this.room.defense)[0]; }

  private buildCast(reset: boolean) {
    const i = this.input, r = this.room;
    [this.judge, this.bailiff, this.counsel.prosecution, this.counsel.defense].forEach(c => this.drop(c));
    this.judge = this.mk(i.judge, 'judge');
    this.bailiff = this.mk(i.bailiff || { name: 'Bailiff', avatar: i.judge.avatar }, 'bailiff');
    this.counsel.prosecution = this.mk(i.prosecution, 'counsel');
    this.counsel.defense = this.mk(i.defense, 'counsel');
    const pretrial = i.mode === 'pretrial';
    this.place(this.bailiff, r.bailiff, false);
    this.place(this.judge, r.judge, true);
    this.place(this.counsel.prosecution, r.prosecution[1] && i.playerRole === 'prosecution' ? r.prosecution[0] : r.prosecution[0], true);
    this.place(this.counsel.defense, r.defense[0], true);
    // the AI counsel sit in the far chair so the player's aisle seat is clear
    const aiRole = i.playerRole === 'prosecution' ? 'defense' : i.playerRole === 'defense' ? 'prosecution' : null;
    if (aiRole) { const s = r[aiRole][1]; this.counsel[aiRole].g.position.set(s.x, s.y, s.z); }
    this.player = null; this.playerState = 'none';
    if (pretrial && i.playerRole && reset) {
      const mine = this.counsel[i.playerRole];
      this.player = mine;
      const d = r.doors.rear;
      this.playerPos.set(d.x, 0, d.z - 0.8); this.playerYaw = Math.PI;
      mine.g.position.copy(this.playerPos); mine.g.rotation.y = this.playerYaw; mine.sitTarget = 0; mine.sa = 0;
      this.playerState = 'walking';
      this.judge.g.visible = false; this.judge.sitTarget = 0; this.judge.sa = 0;
      this.entranceStarted = false; this.judgeSeatedOnce = false;
      this.marker.visible = true;
      const s = this.seatSpot(); this.marker.position.set(s.x, 0, s.z + 0.05);
    } else {
      this.marker.visible = false;
      if (i.playerRole) this.playerState = 'seated';
    }
    this.bailiff.moodT = 0.1; this.judge.moodT = 0;
    this.keyOfRebuilt();
  }
  private keyOfRebuilt() { this.audKey = ''; this.jurorKey = ''; this.witnessKey = ''; this.syncAudience(); this.syncJurors(); this.syncWitness(); }

  private syncAudience() {
    const n = clamp(this.input.audience, 0, this.room.audience.length);
    const key = String(n);
    if (key === this.audKey) return;
    this.audKey = key;
    this.audience.forEach(c => this.drop(c)); this.audience = [];
    const rand = rng(7919), order = this.room.audience.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    order.slice(0, n).forEach((si, k) => {
      const c = this.mk({ name: 'Public', avatar: randomAvatar('gallery-' + si + '-' + k) }, 'public');
      c.moodT = 0.05; this.place(c, this.room.audience[si], true);
      if (this.rise) { c.sitTarget = 0; }
      this.audience.push(c);
    });
  }
  private syncJurors() {
    const list = this.input.jurors.slice(0, this.room.jury.length);
    const key = list.map(j => j.id).join(',') + '|' + JSON.stringify(this.input.jurorVotes || {});
    if (key === this.jurorKey) return;
    const ids = list.map(j => j.id).join(',');
    const rebuild = !this.jurorKey.startsWith(ids + '|') || ids === '';
    this.jurorKey = key;
    if (rebuild) {
      this.jurors.forEach(c => this.drop(c)); this.jurors.clear();
      list.forEach((j, i) => {
        const c = this.mk({ name: j.name || 'Juror', avatar: randomAvatar('juror-' + j.id) }, 'juror');
        c.moodT = 0.05; this.place(c, this.room.jury[i], true); if (this.rise) c.sitTarget = 0;
        this.jurors.set(j.id, c);
      });
    }
    this.labels.forEach(l => l.parent?.remove(l)); this.labels = [];
    const votes = this.input.jurorVotes || {};
    this.jurors.forEach((c, id) => {
      const v = votes[id]; if (!v) return;
      const l = makeLabel(v === 'GUILTY' ? 'GUILTY' : 'NOT GUILTY', v === 'GUILTY' ? '#c0392b' : '#2e7d4f');
      l.position.set(0, 2.15 / c.g.scale.y, 0); c.g.add(l); this.labels.push(l);
    });
  }
  private syncWitness() {
    const w = this.input.witness;
    const key = w ? w.name : '';
    if (key === this.witnessKey) return;
    this.witnessKey = key;
    const old = this.witnessC;
    const r = this.room, box = r.witness;
    if (old) {
      // leaves the stand
      this.witnessC = null;
      old.sitTarget = 0;
      const door = r.doors.side;
      this.walk(old, [V(-5.4, 0.4, -7.3), V(-6.6, 0, -7.0), V(-6.7, 0, -5.8), V(door.x, 0, door.z)], 1.7, null, () => this.drop(old));
    }
    if (w) {
      const c = this.mk(w, 'witness'); this.witnessC = c; c.moodT = -0.05;
      const door = r.doors.side;
      this.place(c, { x: door.x, y: 0, z: door.z, yaw: Math.PI / 2 }, false);
      this.walk(c, [V(-6.7, 0, -5.8), V(-6.6, 0, -7.0), V(-5.4, 0.4, -7.3), V(box.x, box.y, box.z)], 1.7, box.yaw, () => { c.sitTarget = 1; c.g.rotation.y = box.yaw; });
    }
  }

  // ------------------------------------------------------------------ scripted movement and sequences
  private walk(c: Character, path: THREE.Vector3[], speed: number, yaw: number | null, done?: () => void) {
    this.movers = this.movers.filter(m => m.c !== c);
    this.movers.push({ c, path: path.map(p => p.clone()), speed, yaw, done });
  }
  private later(sec: number, fn: () => void) { this.tasks.push({ at: this.time + sec, fn }); }

  private startEntrance() {
    this.entranceStarted = true;
    const r = this.room;
    this.rise = true;
    // everyone but the judge rises
    [...this.audience, ...this.jurors.values(), this.counsel.prosecution, this.counsel.defense].forEach(c => {
      if (c === this.player && this.playerState !== 'seated') return;
      this.later(0.2 + Math.random() * 0.7, () => { c.sitTarget = 0; });
    });
    const j = this.judge;
    j.g.visible = true; j.sitTarget = 0; j.sa = 0;
    const d = r.doors.chambers;
    j.g.position.set(d.x, d.y, d.z);
    this.walk(j, [V(3.4, 0.75, -9.4), V(1.2, 0.75, -9.3), V(0.2, 0.75, -8.9), V(0, 0.75, -8.62)], 1.35, 0, () => {
      j.sitTarget = 1; j.g.rotation.y = 0;
      this.later(1.0, () => { j.gavelT = 0; this.gaveling = 1.3; });
      this.later(2.6, () => {
        this.rise = false;
        [...this.audience, ...this.jurors.values(), this.counsel.prosecution, this.counsel.defense].forEach(c => this.later(Math.random() * 0.8, () => { c.sitTarget = 1; }));
        this.judgeSeatedOnce = true; this.ev.onJudgeSeated?.();
      });
    });
  }
  private gaveling = 0;

  // ------------------------------------------------------------------ input
  private unbind?: () => void;
  private bindInput() {
    const cv = this.canvas;
    let down: { x: number; ox: number; moved: boolean } | null = null;
    const pd = (e: PointerEvent) => { down = { x: e.clientX, ox: e.clientX, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ } };
    const pm = (e: PointerEvent) => { if (!down) return; const dx = e.clientX - down.ox; down.ox = e.clientX; if (Math.abs(e.clientX - down.x) > 7) down.moved = true; if (down.moved) this.orbit = clamp(this.orbit - dx * 0.008, -1.4, 1.4); };
    const pu = (e: PointerEvent) => {
      const d = down; down = null;
      if (!d || d.moved || this.playerState !== 'walking') return;
      const rc = cv.getBoundingClientRect();
      const m = new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
      this.ray.setFromCamera(m, this.cam);
      const pt = new THREE.Vector3();
      if (this.ray.ray.intersectPlane(this.plane, pt)) { this.auto = [V(pt.x, 0, pt.z)]; }
    };
    const kd = (e: KeyboardEvent) => { if (document.activeElement && /TEXTAREA|INPUT/.test(document.activeElement.tagName)) return; this.keys[e.key.toLowerCase()] = true; };
    const ku = (e: KeyboardEvent) => { this.keys[e.key.toLowerCase()] = false; };
    cv.addEventListener('pointerdown', pd); cv.addEventListener('pointermove', pm); cv.addEventListener('pointerup', pu);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    this.unbind = () => { cv.removeEventListener('pointerdown', pd); cv.removeEventListener('pointermove', pm); cv.removeEventListener('pointerup', pu); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }

  private buildMarker() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.66, 36), new THREE.MeshBasicMaterial({ color: 0xffd43b, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 12), new THREE.MeshBasicMaterial({ color: 0xffd43b }));
    arrow.rotation.x = Math.PI; arrow.position.y = 1.9; arrow.name = 'arrow'; g.add(arrow);
    g.visible = false;
    return g;
  }

  // ------------------------------------------------------------------ frame
  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    if (!this.running || !this.input) return;
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    this.time += dt;
    this.step(dt, this.time);
    this.renderer.render(this.scene, this.cam);
  };

  /** Fast-forward the simulation by `sec` seconds in small steps (used by tests and screenshots). */
  advance(sec: number) { const n = Math.ceil(sec / 0.033); for (let i = 0; i < n; i++) { this.time += 0.033; this.step(0.033, this.time); } this.renderer.render(this.scene, this.cam); }

  /** Advance the whole scene by dt. */
  step(dt: number, t: number) {
    this.resize();
    for (let i = this.tasks.length - 1; i >= 0; i--) if (this.tasks[i].at <= t) { const f = this.tasks[i].fn; this.tasks.splice(i, 1); f(); }
    const walked = new Map<Character, number>();
    // scripted movers
    for (let i = this.movers.length - 1; i >= 0; i--) {
      const m = this.movers[i], c = m.c, p = c.g.position;
      const tgt = m.path[0];
      if (!tgt) { this.movers.splice(i, 1); if (m.yaw != null) c.g.rotation.y = m.yaw; m.done?.(); continue; }
      const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.08) { p.y = tgt.y; m.path.shift(); continue; }
      const s = Math.min(d, m.speed * dt);
      p.x += (dx / d) * s; p.z += (dz / d) * s; p.y += (tgt.y - p.y) * Math.min(1, dt * 4);
      c.g.rotation.y += wrap(Math.atan2(dx, dz) - c.g.rotation.y) * Math.min(1, dt * 7);
      walked.set(c, s);
    }
    this.updatePlayer(dt, walked);
    this.animatePeople(dt, t, walked);
    this.updateCamera(dt, t);
    const arrow = this.marker.getObjectByName('arrow'); if (arrow) arrow.position.y = 1.9 + Math.sin(t * 3) * 0.12;
  }

  private hit(x: number, z: number, r: number, b: Box2D) { const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1); return Math.hypot(x - cx, z - cz) < r; }
  private resolve(p: THREE.Vector3, r: number) {
    const B = this.room.bounds; p.x = clamp(p.x, B.x0, B.x1); p.z = clamp(p.z, B.z0, B.z1);
    for (const b of this.room.obstacles) {
      if (!this.hit(p.x, p.z, r, b)) continue;
      const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
      let nx = p.x - cx, nz = p.z - cz; const d = Math.hypot(nx, nz);
      if (d < 1e-4) { // inside: push out the nearest side
        const left = p.x - b.x0, right = b.x1 - p.x, top = p.z - b.z0, bot = b.z1 - p.z, m = Math.min(left, right, top, bot);
        if (m === left) p.x = b.x0 - r; else if (m === right) p.x = b.x1 + r; else if (m === top) p.z = b.z0 - r; else p.z = b.z1 + r;
      } else { nx /= d; nz /= d; p.x = cx + nx * r; p.z = cz + nz * r; }
    }
  }

  private updatePlayer(dt: number, walked: Map<Character, number>) {
    const c = this.player; if (!c) return;
    const pos = this.playerPos;
    if (this.playerState === 'walking') {
      let dir: THREE.Vector3 | null = null, speed = 2.7;
      let jx = this.joy.x, jy = this.joy.y; const k = this.keys;
      if (k['arrowup'] || k['w']) jy += 1; if (k['arrowdown'] || k['s']) jy -= 1; if (k['arrowleft'] || k['a']) jx -= 1; if (k['arrowright'] || k['d']) jx += 1;
      const m = Math.hypot(jx, jy);
      if (m > 0.12) {
        if (m > 1) { jx /= m; jy /= m; }
        // camera looks along -z by default (toward the bench); up on the stick walks that way
        const h = this.followYaw(); const fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
        dir = V(fx * jy + rx * jx, 0, fz * jy + rz * jx); speed = 2.7 * Math.min(1, m); this.auto = [];
      } else if (this.auto.length) {
        const a = this.auto[0], dx = a.x - pos.x, dz = a.z - pos.z, d = Math.hypot(dx, dz);
        if (d < 0.12) this.auto.shift(); else dir = V(dx / d, 0, dz / d);
      }
      let moved = 0;
      if (dir && dir.lengthSq() > 0) {
        const np = pos.clone().addScaledVector(dir, speed * dt);
        this.resolve(np, 0.38);
        moved = Math.hypot(np.x - pos.x, np.z - pos.z);
        pos.copy(np);
        this.playerYaw += wrap(Math.atan2(dir.x, dir.z) - this.playerYaw) * Math.min(1, dt * 9);
      }
      c.g.position.set(pos.x, 0, pos.z); c.g.rotation.y = this.playerYaw;
      walked.set(c, moved);
      const s = this.seatSpot();
      if (Math.hypot(pos.x - s.x, pos.z - (s.z + 0.05)) < 0.55) { this.playerState = 'sitting'; this.auto = []; this.marker.visible = false; }
    } else if (this.playerState === 'sitting') {
      const s = this.seatSpot();
      c.g.position.x += (s.x - c.g.position.x) * Math.min(1, dt * 6); c.g.position.z += (s.z - c.g.position.z) * Math.min(1, dt * 6);
      c.g.rotation.y += wrap(s.yaw - c.g.rotation.y) * Math.min(1, dt * 7);
      c.sitTarget = 1;
      if (c.sa > 0.92) { this.playerState = 'seated'; this.ev.onSeated?.(); }
    }
  }
  private followYaw() { return Math.PI + this.orbit; }

  private speakerChar(who: StageSpeaker): Character | null {
    switch (who) {
      case 'judge': return this.judge;
      case 'bailiff': return this.bailiff;
      case 'prosecution': return this.counsel.prosecution;
      case 'defense': return this.counsel.defense;
      case 'witness': return this.witnessC;
      case 'jury': { const a = [...this.jurors.values()]; return a.length ? a[Math.floor(this.time / 3) % a.length] : null; }
      default: return null;
    }
  }

  private animatePeople(dt: number, t: number, walked: Map<Character, number>) {
    const i = this.input, active = i.active, talkingNow = i.talking;
    const starting = i.mode === 'pretrial' && !i.begun;
    const spk = this.speakerChar(active);
    const head = spk ? headPos(spk) : null;
    const gavelT = this.gaveling > 0;
    if (this.gaveling > 0) this.gaveling -= dt;

    const poseFor = (c: Character, role: string): PoseName => {
      const isActive = active === role;
      const moving = (walked.get(c) || 0) > 0.002 || this.movers.some(m => m.c === c);
      if (moving) return 'walk';
      if (role === 'judge') return gavelT ? 'gavel' : isActive && talkingNow ? 'talk' : 'desk';
      if (role === 'bailiff') return isActive && talkingNow ? 'talk' : 'attention';
      if (role === 'witness') return isActive && talkingNow ? 'talk' : 'lap';
      if (role === 'prosecution' || role === 'defense') {
        if (c.sitTarget === 0) return isActive && talkingNow ? 'talk' : 'attention';
        return 'desk';
      }
      return 'lap';
    };
    const who = (c: Character, role: string) => {
      // counsel stand to speak and sit when the floor moves on (trial and after the pre-trial script)
      if ((role === 'prosecution' || role === 'defense') && !this.rise && !(c === this.player && this.playerState !== 'seated') && !starting) {
        const wantStand = active === role && i.mode === 'trial';
        c.sitTarget = wantStand ? 0 : 1;
      }
      c.moodT = role === 'witness' ? -0.05 : 0.08;
      // gaze: everyone watches whoever speaks, with the odd glance away
      if (spk && spk !== c && head && Math.sin(t * 0.37 + c.po * 3) > -0.35) c.look = head; else c.look = null;
      if (c === this.player && this.playerState === 'walking') c.look = null;
      pose(c, poseFor(c, role), dt, walked.get(c) || 0, t);
    };
    who(this.judge, 'judge'); who(this.bailiff, 'bailiff');
    who(this.counsel.prosecution, 'prosecution'); who(this.counsel.defense, 'defense');
    if (this.witnessC) who(this.witnessC, 'witness');
    this.jurors.forEach(c => who(c, 'jury'));
    this.audience.forEach(c => who(c, 'public'));
  }

  // ------------------------------------------------------------------ camera
  private shotFor(name: string, t: number): { pos: THREE.Vector3; look: THREE.Vector3; hfov: number } {
    const near = (c: Character | null, dist: number, side: number, lift: number, hfov: number) => {
      if (!c) return this.shotFor('wide', t);
      const h = headPos(c), yaw = c.g.rotation.y;
      const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      return { pos: V(h.x + fx * dist + rx * side, h.y + lift, h.z + fz * dist + rz * side), look: V(h.x, h.y - 0.3, h.z), hfov };
    };
    const sway = Math.sin(t * 0.25) * 0.25;
    switch (name) {
      case 'judge': return near(this.judge, 3.3, 0.7 + sway * 0.3, 0.55, 46);
      case 'bailiff': return near(this.bailiff, 3.0, -0.5, 0.15, 44);
      case 'prosecution': return near(this.counsel.prosecution, this.counsel.prosecution.sitTarget ? 2.9 : 3.3, 0.6, 0.35, 46);
      case 'defense': return near(this.counsel.defense, this.counsel.defense.sitTarget ? 2.9 : 3.3, -0.6, 0.35, 46);
      case 'witness': return near(this.witnessC, 3.0, 0.5, 0.25, 44);
      case 'jury': return { pos: V(2.2, 2.4 + sway * 0.1, -4.6 + sway), look: V(6.7, 1.0, -5.1), hfov: 58 };
      case 'audience': { const pan = Math.sin(t * 0.35) * 3.2; return { pos: V(pan * 0.3, 2.4, 1.1), look: V(pan, 1.15, 6.2), hfov: 54 }; }
      case 'player': return near(this.player, 3.4, 0.5, 0.5, 50);
      default: return { pos: V(sway * 1.2, 4.7, 10.2), look: V(0, 1.0, -3.4), hfov: 66 };
    }
  }

  private pickShot(): string {
    const i = this.input;
    if (i.shot) return i.shot;
    if (i.mode === 'pretrial' && !i.begun) return this.playerState === 'seated' || this.playerState === 'sitting' ? 'wide' : 'follow';
    return i.active === 'bailiff' ? 'bailiff' : i.active === 'jury' ? 'jury' : i.active;
  }

  private updateCamera(dt: number, t: number) {
    const name = this.pickShot();
    if (name !== this.shotName) { this.shotName = name; this.ev.onFocus?.(name); }
    let pos: THREE.Vector3, look: THREE.Vector3, hfov: number;
    if (name === 'follow' && this.player) {
      const h = this.followYaw(), p = this.playerPos, fx = Math.sin(h), fz = Math.cos(h);
      pos = V(p.x - fx * 3.6, 3.3, p.z - fz * 3.6); look = V(p.x + fx * 2.6, 0.9, p.z + fz * 2.6); hfov = 74;
      pos.x = clamp(pos.x, -7.4, 7.4); pos.z = clamp(pos.z, -9.6, 10.85);
    } else { const s = this.shotFor(name, t); pos = s.pos; look = s.look; hfov = s.hfov; }
    const k = 1 - Math.exp(-dt * (name === 'follow' ? 5 : 2.6));
    this.camPos.lerp(pos, k); this.camLook.lerp(look, k); this.camFov += (hfov - this.camFov) * k;
    this.cam.position.copy(this.camPos);
    this.cam.lookAt(this.camLook);
    const asp = this.cam.aspect || 1.6;
    const vfov = clamp((2 * Math.atan(Math.tan((this.camFov * Math.PI) / 360) / asp) * 180) / Math.PI, 28, 80);
    if (Math.abs(this.cam.fov - vfov) > 0.05) { this.cam.fov = vfov; this.cam.updateProjectionMatrix(); }
  }
}

function avKey(p: Person) { return p.name + JSON.stringify(p.avatar); }
