/** Home-screen background. Drop the video at public/videos/hero.mp4 (keep it ~500 KB, muted loop). */
export const HERO_VIDEO = '/videos/hero.mp4';
/** Shown instantly while the video loads, and as the fallback if the video is missing or can't play. */
export const HERO_POSTER = '/images/hero/gavel-strike.jpg';

/**
 * Home screen artwork: the whole picture (900x2007, about 40 KB as WebP, lower part softened because it sits under the dark covering, JPEG fallback) used as the full-screen background.
 * The file name is versioned because /images/home/ is cached as immutable: change the artwork => bump the name.
 * `lqip` is a tiny blurred copy inlined here so the screen is never empty while the real image downloads.
 */
export const HOME_ART = {
  webp: '/images/home/courtroom-v3.webp',
  jpg: '/images/home/courtroom-v3.jpg',
  width: 900,
  height: 2007,
  lqip: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA4KCw0LCQ4NDA0QDw4RFiQXFhQUFiwgIRokNC43NjMuMjI6QVNGOj1OPjIySGJJTlZYXV5dOEVmbWVabFNbXVn/2wBDAQ8QEBYTFioXFypZOzI7WVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVn/wAARCAA2ABgDASIAAhEBAxEB/8QAGwAAAgMAAwAAAAAAAAAAAAAAAAMCBAUBBgf/xAAmEAABAwQCAQMFAAAAAAAAAAABAAIDBBESIQUTMSJBkRQVMkKB/8QAFwEBAQEBAAAAAAAAAAAAAAAAAgEAA//EABkRAAMBAQEAAAAAAAAAAAAAAAABEQJREv/aAAwDAQACEQMRAD8A87LdaUsPRdPEBcAQNE2WkOPb0EnQUpYzFa1CsmAty9xdCtJDsVDEBxMrXRtzLgWk2T4qGWXjH1Ae3Fv6lY31TBGdSdlwfOrLVp6nDhpXyCPZsBkMiD72ReeHZPpmSxtNP2Bpyzte2rWQoxVQj7PTdrzoX0P4hVqBtFxwVNLKMWMcSLb2FOCmk7W97HOjB2GmySzkJx7Apw5WpA8N+EG9DXglNRulle2BhjjH4hxQl/dKknw34QtdGmCg12wpZFCEgHGZuUIQsY//2Q==',
};
