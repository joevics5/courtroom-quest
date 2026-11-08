/** The verdict card people share: a fixed template with the case details dropped into it, drawn on a canvas. */

export const SHARE_CAPTION = 'Can you do better? >> Play Courtroom Quest www.courtroomquest.app';

export interface VerdictCardInfo {
  won: boolean;
  caseTitle: string;
  /** Guilty / Not Guilty / Partial Verdict */
  verdictWord: string;
  /** "Defense" or "Prosecution" */
  roleLabel: string;
  rankTitle: string;
  score?: number | null;
}

const W = 1080;
const H = 1350;
const GAME_FONT = "'Bangers', Impact, 'Arial Black', sans-serif";
const BODY_FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";

/** Splits text into lines that fit `maxWidth`, at most `maxLines` (the last line gets an ellipsis if cut). */
export function wrapLines(measure: (s: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (measure(next) <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = words[i];
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  const used = lines.join(' ').split(/\s+/).length;
  if (used < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.replace(/[\s,.;:]+$/, '')}…`;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderVerdictCard(info: VerdictCardInfo): Promise<Blob> {
  try {
    await Promise.all([document.fonts?.load(`80px Bangers`), document.fonts?.ready]);
  } catch {
    /* fall back to the system fonts */
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const accent = info.won ? '#FFD43B' : '#FF7A7E';

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#171a2b');
  bg.addColorStop(1, '#05060a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 520, 40, W / 2, 520, 700);
  glow.addColorStop(0, info.won ? 'rgba(255,212,59,0.22)' : 'rgba(255,122,126,0.18)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // frame
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  roundRect(ctx, 36, 36, W - 72, H - 72, 40);
  ctx.stroke();

  // logo
  ctx.fillStyle = '#FFD43B';
  ctx.font = `76px ${GAME_FONT}`;
  ctx.fillText('COURTROOM QUEST', W / 2, 160);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(W / 2 - 120, 190, 240, 4);

  // scales
  ctx.font = `150px ${BODY_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('⚖️', W / 2, 360);

  // result
  ctx.font = `200px ${GAME_FONT}`;
  ctx.fillStyle = accent;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowOffsetY = 8;
  ctx.fillText(info.won ? 'VICTORY' : 'DEFEAT', W / 2, 560);
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetY = 0;

  // case panel
  const px = 90, pw = W - 180, py = 630, ph = 400;
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  roundRect(ctx, px, py, pw, ph, 32);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `600 28px ${BODY_FONT}`;
  ctx.fillText('THE CASE', W / 2, py + 62);

  ctx.fillStyle = '#ffffff';
  ctx.font = `66px ${GAME_FONT}`;
  const titleLines = wrapLines(s => ctx.measureText(s).width, info.caseTitle, pw - 80, 2);
  titleLines.forEach((line, i) => ctx.fillText(line, W / 2, py + 140 + i * 74));
  const afterTitle = py + 140 + (titleLines.length - 1) * 74;

  ctx.fillStyle = accent;
  ctx.font = `700 40px ${BODY_FONT}`;
  ctx.fillText(`Verdict: ${info.verdictWord}`, W / 2, afterTitle + 80);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `500 32px ${BODY_FONT}`;
  ctx.fillText(`Played as ${info.roleLabel}`, W / 2, afterTitle + 130);

  // score bar
  if (typeof info.score === 'number') {
    const sx = px + 60, sw = pw - 120, sy = py + ph - 70;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, sx, sy, sw, 22, 11);
    ctx.fill();
    ctx.fillStyle = info.score >= 80 ? '#2EC4B6' : info.score >= 60 ? '#FFD43B' : '#E5484D';
    roundRect(ctx, sx, sy, Math.max(22, (sw * Math.min(100, Math.max(0, info.score))) / 100), 22, 11);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 30px ${BODY_FONT}`;
    ctx.fillText(`Score ${Math.round(info.score)}/100`, W / 2, sy - 18);
  }

  // rank pill
  ctx.font = `54px ${GAME_FONT}`;
  const rankText = info.rankTitle.toUpperCase();
  const rw = ctx.measureText(rankText).width + 90;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, W / 2 - rw / 2, 1090, rw, 90, 45);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(rankText, W / 2, 1155);

  // footer inside the card
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `500 28px ${BODY_FONT}`;
  ctx.fillText('courtroomquest.app', W / 2, 1272);

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png');
  });
}

/**
 * Shares the card as a picture with the caption under it. Where the browser cannot share files, the picture is
 * downloaded and the caption copied. Returns what happened so the screen can say so.
 */
export async function shareVerdictCard(blob: Blob, fileName = 'courtroom-quest-verdict.png'): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], fileName, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: SHARE_CAPTION });
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'cancelled';
      /* otherwise fall through to the download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  try {
    await navigator.clipboard?.writeText(SHARE_CAPTION);
  } catch {
    /* copying is a bonus */
  }
  return 'downloaded';
}
