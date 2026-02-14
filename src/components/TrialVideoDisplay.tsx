import { useEffect, useRef, useState } from 'react';

interface TrialVideoDisplayProps {
  currentPhase: number;
  currentSpeaker?: 'judge' | 'prosecution' | 'defense' | 'witness' | 'jury';
}

const PHASE_VIDEOS: Record<number, string> = {
  1: 'https://assets.mixkit.co/videos/preview/mixkit-empty-courtroom-with-wooden-furniture-4613-large.mp4',
  2: 'https://assets.mixkit.co/videos/preview/mixkit-bailiff-in-a-courtroom-4614-large.mp4',
  3: 'https://assets.mixkit.co/videos/preview/mixkit-judge-entering-courtroom-4616-large.mp4',
  4: 'https://assets.mixkit.co/videos/preview/mixkit-judge-at-desk-in-courtroom-4617-large.mp4',
  5: 'https://assets.mixkit.co/videos/preview/mixkit-lawyer-reading-a-document-in-his-office-4615-large.mp4',
  6: 'https://assets.mixkit.co/videos/preview/mixkit-defendant-in-courtroom-4618-large.mp4',
};

const SPEAKER_VIDEOS: Record<string, string> = {
  judge: 'https://assets.mixkit.co/videos/preview/mixkit-judge-at-desk-in-courtroom-4617-large.mp4',
  prosecution: 'https://assets.mixkit.co/videos/preview/mixkit-lawyer-reading-a-document-in-his-office-4615-large.mp4',
  defense: 'https://assets.mixkit.co/videos/preview/mixkit-lawyer-reading-a-document-in-his-office-4615-large.mp4',
  witness: 'https://assets.mixkit.co/videos/preview/mixkit-defendant-in-courtroom-4618-large.mp4',
  jury: 'https://assets.mixkit.co/videos/preview/mixkit-empty-courtroom-with-wooden-furniture-4613-large.mp4',
};

export default function TrialVideoDisplay({ currentPhase, currentSpeaker }: TrialVideoDisplayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');

  useEffect(() => {
    let newVideoUrl = '';

    if (currentPhase >= 1 && currentPhase <= 6) {
      newVideoUrl = PHASE_VIDEOS[currentPhase] || PHASE_VIDEOS[1];
    } else if (currentSpeaker) {
      newVideoUrl = SPEAKER_VIDEOS[currentSpeaker] || SPEAKER_VIDEOS.judge;
    } else {
      newVideoUrl = SPEAKER_VIDEOS.judge;
    }

    if (newVideoUrl !== videoUrl) {
      setVideoUrl(newVideoUrl);
    }
  }, [currentPhase, currentSpeaker]);

  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.load();
      videoRef.current.play().catch(err => {
        console.log('Video autoplay prevented:', err);
      });
    }
  }, [videoUrl]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg">
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src={videoUrl} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-slate-900/60" />
    </div>
  );
}
