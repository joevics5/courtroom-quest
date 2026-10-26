import { useEffect, useMemo, useRef, useState } from 'react';
import type { StageSpeaker } from '../../lib/stageSpeaker';
import { CourtStage, type Person, type ShotName, type StageInput } from './stage';

export interface Court3DProps {
  mode: 'pretrial' | 'trial';
  judge: Person;
  prosecution: Person;
  defense: Person;
  bailiff?: Person;
  playerRole?: 'prosecution' | 'defense';
  active: StageSpeaker;
  talking: boolean;
  shot?: ShotName | null;
  witness?: Person | null;
  jurors?: { id: string; name?: string }[];
  jurorVotes?: Record<string, 'GUILTY' | 'NOT_GUILTY'>;
  audience?: number;
  /** Pre-trial: true once the player has pressed Start. */
  begun?: boolean;
  /** Pre-trial: called when the player is sitting in their chair. */
  onSeated?: () => void;
  /** Pre-trial: the judge has entered and sat down. */
  onJudgeSeated?: () => void;
  onFailed?: () => void;
  className?: string;
  /** Show the walking controls (pre-trial, before the player is seated). */
  controls?: boolean;
  children?: React.ReactNode;
}

const NAMES: Record<string, string> = { judge: 'Judge', prosecution: 'Prosecution', defense: 'Defense', witness: 'Witness', jury: 'Jury', bailiff: 'Bailiff' };

/** The WebGL canvas, the walking joystick and a caption for whoever has the floor. */
export default function Court3D(p: Court3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<CourtStage | null>(null);
  const joyRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [seated, setSeated] = useState(false);
  const cbs = useRef({ onSeated: p.onSeated, onFailed: p.onFailed, onJudgeSeated: p.onJudgeSeated });
  cbs.current = { onSeated: p.onSeated, onFailed: p.onFailed, onJudgeSeated: p.onJudgeSeated };

  const input: StageInput = useMemo(() => ({
    mode: p.mode, judge: p.judge, prosecution: p.prosecution, defense: p.defense, bailiff: p.bailiff, playerRole: p.playerRole,
    active: p.active, talking: p.talking, shot: p.shot ?? null, witness: p.witness ?? null, jurors: p.jurors ?? [], jurorVotes: p.jurorVotes,
    audience: p.audience ?? 22, begun: !!p.begun
  }), [p.mode, p.judge, p.prosecution, p.defense, p.bailiff, p.playerRole, p.active, p.talking, p.shot, p.witness, p.jurors, p.jurorVotes, p.audience, p.begun]);
  const inputRef = useRef(input); inputRef.current = input;

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    let stage: CourtStage | null = null;
    try {
      stage = new CourtStage(cv, { onSeated: () => { setSeated(true); cbs.current.onSeated?.(); }, onJudgeSeated: () => cbs.current.onJudgeSeated?.() });
      stage.set(inputRef.current);
      stageRef.current = stage;
      (window as unknown as { __court3d?: CourtStage }).__court3d = stage;
      setReady(true);
    } catch {
      cbs.current.onFailed?.();
      return;
    }
    const ro = new ResizeObserver(() => stage?.resize()); ro.observe(cv);
    const io = new IntersectionObserver(es => stage?.setRunning(es[0]?.isIntersecting ?? true)); io.observe(cv);
    const vis = () => stage?.setRunning(!document.hidden); document.addEventListener('visibilitychange', vis);
    const lost = (e: Event) => { e.preventDefault(); cbs.current.onFailed?.(); }; cv.addEventListener('webglcontextlost', lost);
    return () => { ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', vis); cv.removeEventListener('webglcontextlost', lost); stage?.dispose(); stageRef.current = null; };
  }, []);

  useEffect(() => { stageRef.current?.set(input); }, [input]);

  // joystick
  useEffect(() => {
    const joy = joyRef.current; if (!joy) return;
    const knob = joy.querySelector('i') as HTMLElement | null;
    let id: number | null = null;
    const move = (e: PointerEvent) => {
      const rc = joy.getBoundingClientRect(), cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy; const m = Math.hypot(dx, dy), R = rc.width / 2 - 8, s = m > R ? R / m : 1;
      dx *= s; dy *= s; if (knob) knob.style.transform = `translate(${dx}px,${dy}px)`;
      stageRef.current?.setJoystick(dx / R, -dy / R);
    };
    const end = (e: PointerEvent) => { if (e.pointerId !== id) return; id = null; stageRef.current?.setJoystick(0, 0); if (knob) knob.style.transform = ''; };
    const down = (e: PointerEvent) => { id = e.pointerId; try { joy.setPointerCapture(id); } catch { /* ignore */ } move(e); e.stopPropagation(); };
    const mv = (e: PointerEvent) => { if (e.pointerId === id) move(e); };
    joy.addEventListener('pointerdown', down); joy.addEventListener('pointermove', mv); joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
    return () => { joy.removeEventListener('pointerdown', down); joy.removeEventListener('pointermove', mv); joy.removeEventListener('pointerup', end); joy.removeEventListener('pointercancel', end); };
  }, [ready, p.controls]);

  const walking = p.controls && !seated && p.mode === 'pretrial' && !p.begun;
  const speaker = p.active;
  const caption =
    speaker === 'judge' ? p.judge.name
      : speaker === 'prosecution' ? p.prosecution.name
        : speaker === 'defense' ? p.defense.name
          : speaker === 'witness' ? p.witness?.name || 'Witness'
            : speaker === 'bailiff' ? p.bailiff?.name || 'Bailiff'
              : 'Jury';

  return (
    <div className={`relative overflow-hidden bg-[#120d14] ${p.className ?? ''}`} data-testid="court3d">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block touch-none" aria-label="3D courtroom" role="img" />
      {ready && (p.mode === 'trial' || p.begun) && (
        <div className="absolute left-2 bottom-2 z-10 pointer-events-none rounded-lg bg-black/60 border border-white/15 px-2.5 py-1 text-white">
          <span className="text-[10px] uppercase tracking-wider text-[#FFD43B] block leading-tight">{NAMES[speaker]}</span>
          <span className="text-xs sm:text-sm leading-tight block max-w-[14rem] truncate">{caption}</span>
        </div>
      )}
      {walking && (
        <>
          <div ref={joyRef} data-testid="joystick" aria-label="Move" className="absolute left-3 bottom-3 z-10 w-24 h-24 rounded-full bg-white/10 border border-white/25 touch-none select-none">
            <i className="absolute left-1/2 top-1/2 -ml-6 -mt-6 w-12 h-12 rounded-full bg-[#FFD43B]/90 shadow-lg" />
          </div>
          <button type="button" onClick={() => stageRef.current?.autoWalkToSeat()} className="absolute right-3 bottom-3 z-10 rounded-full bg-black/65 border border-white/25 text-white text-xs px-3 py-2">
            Take me to my seat
          </button>
          <div className="absolute inset-x-0 top-2 z-10 flex justify-center pointer-events-none">
            <span className="rounded-full bg-black/65 border border-[#FFD43B]/60 text-[#FFD43B] text-xs px-3 py-1">Walk to the glowing chair</span>
          </div>
        </>
      )}
      {p.children}
    </div>
  );
}
