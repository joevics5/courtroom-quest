/** Home-screen background. Drop the video at public/videos/hero.mp4 (keep it ~500 KB, muted loop). */
export const HERO_VIDEO = '/videos/hero.mp4';
/** Shown instantly while the video loads, and as the fallback if the video is missing or can't play. */
export const HERO_POSTER = '/images/hero/gavel-strike.jpg';

/** Illustration under the logo on the home screen (portrait 900x2007; shown as a cropped card). WebP with a JPEG fallback. */
export const HOME_ART = {
  webp: '/images/home/courtroom.webp',
  jpg: '/images/home/courtroom.jpg',
  width: 900,
  height: 2007,
  alt: 'A stern judge with a gavel, flanked by a prosecutor and a defence lawyer holding case files',
};
