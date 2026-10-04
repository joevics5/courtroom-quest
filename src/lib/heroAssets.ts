/** Home-screen background. Drop the video at public/videos/hero.mp4 (keep it ~500 KB, muted loop). */
export const HERO_VIDEO = '/videos/hero.mp4';
/** Shown instantly while the video loads, and as the fallback if the video is missing or can't play. */
export const HERO_POSTER = '/images/hero/gavel-strike.jpg';

/**
 * Illustration under the logo on the home screen. Only the band of the artwork that can ever be visible
 * (it is cropped by the card) is shipped: 720x980, ~30 KB as WebP, with a JPEG fallback.
 * The file name is versioned because /images/home/ is cached as immutable: change the artwork => bump the name.
 * `lqip` is a tiny blurred copy inlined here so the card is never empty while the real image downloads.
 */
export const HOME_ART = {
  webp: '/images/home/courtroom-v2.webp',
  jpg: '/images/home/courtroom-v2.jpg',
  width: 720,
  height: 980,
  alt: 'A stern judge with a gavel, flanked by a prosecutor and a defence lawyer holding case files',
  lqip: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA4KCw0LCQ4NDA0QDw4RFiQXFhQUFiwgIRokNC43NjMuMjI6QVNGOj1OPjIySGJJTlZYXV5dOEVmbWVabFNbXVn/2wBDAQ8QEBYTFioXFypZOzI7WVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVn/wAARCAAhABgDASIAAhEBAxEB/8QAGgABAAIDAQAAAAAAAAAAAAAAAAQFAQIGA//EACYQAAEEAgIBAgcAAAAAAAAAAAEAAgMRBCESEwUyQhQiQVFxgaH/xAAYAQADAQEAAAAAAAAAAAAAAAAAAQIEA//EABoRAQEBAAMBAAAAAAAAAAAAAAEAAhESMUH/2gAMAwEAAhEDEQA/AOFbAXAEDRNKxGA3oJOgrHBiA8TK10beZcC0khSIsGWXxj8kPbTfaVCt1Mlypg48vtaKyljacfsDTfOrrVUifNPW1+KYIzp5ksG71StMfJ4eGlfJ12TQbY5EH60qeODJxZRxaxxIrewvSDFk7m98bnsB2GmtIXNZ2+SLK6+fy2JDoXofpFmbDdNK8QRmKMelrjf9RDoaTOins9Slx+lEWbVrLX3H8IiJnkn2/9k=',
};
