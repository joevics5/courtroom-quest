/** Home-screen background. Drop the video at public/videos/hero.mp4 (keep it ~500 KB, muted loop). */
export const HERO_VIDEO = '/videos/hero.mp4';
/** Shown instantly while the video loads, and as the fallback if the video is missing or can't play. */
export const HERO_POSTER = '/images/hero/gavel-strike.jpg';

/**
 * Home screen artwork, on an extended canvas (1174x2527, about 45 KB as WebP, JPEG fallback).
 * The original picture (900x2007) sits inside it; the sides, top and bottom continue as a soft blurred smear that fades into
 * the page colour, so the picture can be shown smaller (smaller characters, the desk visible) without empty margins.
 * The part of the desk below the sound block is softened so it reads as a calm background behind the buttons.
 * The file name is versioned because /images/home/ is cached as immutable: change the artwork => bump the name.
 * `lqip` is a tiny blurred copy inlined here so the screen is never empty while the real image downloads.
 */
export const HOME_ART = {
  webp: '/images/home/courtroom-v5.webp',
  jpg: '/images/home/courtroom-v5.jpg',
  width: 1174,
  height: 2527,
  lqip: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA4KCw0LCQ4NDA0QDw4RFiQXFhQUFiwgIRokNC43NjMuMjI6QVNGOj1OPjIySGJJTlZYXV5dOEVmbWVabFNbXVn/2wBDAQ8QEBYTFioXFypZOzI7WVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVn/wAARCAA0ABgDASIAAhEBAxEB/8QAGwABAAICAwAAAAAAAAAAAAAAAAQFAgMBBgf/xAAlEAACAgIBAwMFAAAAAAAAAAABAgADBBEhBRJREzFxIjJBYZH/xAAXAQEBAQEAAAAAAAAAAAAAAAACAQAD/8QAGxEAAgIDAQAAAAAAAAAAAAAAAAECERJBUSH/2gAMAwEAAhEDEQA/APOu3jc59P6dyXjYtmQCK0LEDfHiWAwEGLs++pLLiykCcbiSbafTQ/ERWSi26O4x1LgMxKEHX4Esqxjv0m5goNobhu72nXKEsVFZ0c1k868SdS1r1nF2aaCd7K7P69oGkdU3w15irZirYGHC618RNGRTaK2ZVJQcb1EXmgO9mOPm3JWqr2kDyJKHU8gL9qfyVKNoTP1IHFMam+k3Iz77KWVggB8CJAZ9qRESVBlKzVuNmIiANxETGP/Z',
};
