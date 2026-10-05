/** Home-screen background. Drop the video at public/videos/hero.mp4 (keep it ~500 KB, muted loop). */
export const HERO_VIDEO = '/videos/hero.mp4';
/** Shown instantly while the video loads, and as the fallback if the video is missing or can't play. */
export const HERO_POSTER = '/images/hero/gavel-strike.jpg';

/**
 * Home screen artwork: the whole picture (900x2007, about 40 KB as WebP, the part below the desk edge is softened so it reads as a calm background behind the buttons, JPEG fallback) used as the full-screen background.
 * The file name is versioned because /images/home/ is cached as immutable: change the artwork => bump the name.
 * `lqip` is a tiny blurred copy inlined here so the screen is never empty while the real image downloads.
 */
export const HOME_ART = {
  webp: '/images/home/courtroom-v4.webp',
  jpg: '/images/home/courtroom-v4.jpg',
  width: 900,
  height: 2007,
  lqip: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA4KCw0LCQ4NDA0QDw4RFiQXFhQUFiwgIRokNC43NjMuMjI6QVNGOj1OPjIySGJJTlZYXV5dOEVmbWVabFNbXVn/2wBDAQ8QEBYTFioXFypZOzI7WVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVn/wAARCAA2ABgDASIAAhEBAxEB/8QAGwAAAgMAAwAAAAAAAAAAAAAAAAMCBAUBBgf/xAAlEAABAwQCAQQDAAAAAAAAAAABAAIDBBESIQUTMSJBgZEVMkL/xAAXAQEBAQEAAAAAAAAAAAAAAAACAQAD/8QAGhEAAwEAAwAAAAAAAAAAAAAAAAERAhJBUf/aAAwDAQACEQMRAD8A87LdaUsPRdPEBcAQNE2WkOPb0EnQUpYzFa1CsmAty9xdCtJDsVDEBxMrXRtzLgWk2T4qGWXjH1Ae3Fv8lYxqmCM6k7L386stWnqcOGlfII9mwGQyIPvZF58Oya7MyWNpp+wNOWdr21ayFGKqEfZ6btedC+h8IVagbRccFTSyjFjHEi29hMgppO1vexzowdhptpIZyM48Bp+E4crUgeG/SDehrgSmo3TSvbBGY4x+rXFCX+UqSfDfpC10aYKDSbhSyKEJAOMjdCELGP/Z',
};
