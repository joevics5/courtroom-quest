import { useState } from 'react';
import { HERO_VIDEO, HERO_POSTER } from '../lib/heroAssets';

/**
 * Shared full-screen background: looping muted video with the poster as the
 * instant image and the fallback if the video is missing or can't play.
 * `overlay` is a Tailwind gradient that keeps text readable.
 */
export default function HeroBackground({ overlay }: { overlay: string }) {
  const [videoFailed, setVideoFailed] = useState(false);
  return (
    <>
      {videoFailed ? (
        <img src={HERO_POSTER} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={HERO_VIDEO}
          poster={HERO_POSTER}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onError={() => setVideoFailed(true)}
        />
      )}
      <div className={`absolute inset-0 bg-gradient-to-b ${overlay}`} />
    </>
  );
}
