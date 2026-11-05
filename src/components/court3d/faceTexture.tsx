import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import AvatarFace from '../AvatarFace';
import type { AvatarConfig } from '../../lib/avatars';

/**
 * The player's real avatar face, as two small pictures for the 3D head: mouth closed and mouth open (used while
 * the character talks). Drawn from the same code as the 2D avatar, so every face setting carries over.
 */
const SIZE = 256;

/** The face as a standalone SVG picture. */
export function faceSvg(config: AvatarConfig, mouthOpen: boolean): string {
  const svg = renderToStaticMarkup(<AvatarFace config={config} faceOnly mouthOpen={mouthOpen} label="Face" />);
  // a standalone SVG needs a size to be drawn to a canvas
  return svg.replace('<svg ', `<svg width="${SIZE}" height="${SIZE}" `);
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('face picture failed to load'));
    img.src = src;
  });
}

async function toTexture(config: AvatarConfig, mouthOpen: boolean): Promise<THREE.CanvasTexture> {
  const img = await load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(faceSvg(config, mouthOpen)));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d canvas');
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  // fade the picture out toward its edges so it melts into the 3D head's own skin instead of showing a border
  ctx.globalCompositeOperation = 'destination-in';
  const fade = ctx.createRadialGradient(SIZE / 2, SIZE * 0.52, SIZE * 0.2, SIZE / 2, SIZE * 0.52, SIZE * 0.5);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.72, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export interface FaceTextures {
  neutral: THREE.Texture;
  talk: THREE.Texture;
}

const cache = new Map<string, Promise<FaceTextures>>();

/** Both pictures for an avatar. Cached, so the same person is only drawn once however often they appear. */
export function makeFaceTextures(config: AvatarConfig): Promise<FaceTextures> {
  const key = JSON.stringify(config);
  let hit = cache.get(key);
  if (!hit) {
    hit = Promise.all([toTexture(config, false), toTexture(config, true)]).then(([neutral, talk]) => ({ neutral, talk }));
    hit.catch(() => cache.delete(key)); // try again next time
    cache.set(key, hit);
  }
  return hit;
}
