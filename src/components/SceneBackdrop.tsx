import { HERO_POSTER } from '../lib/heroAssets';

/**
 * Still courtroom background for the in-game screens (pre-trial, trial): same artwork as the
 * home screen, dimmed so text stays readable. A still image on purpose: no looping video
 * running behind a long trial (battery and data on phones).
 */
export default function SceneBackdrop() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      <img src={HERO_POSTER} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/78 to-black/92" />
    </div>
  );
}
