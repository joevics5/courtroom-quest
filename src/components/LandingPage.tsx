import { Briefcase, FileText, Swords, Settings as SettingsIcon, Gavel, Trophy, Flame } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import CaseOfTheWeek from './CaseOfTheWeek';
import type { UserProfile } from '../types';

interface LandingPageProps {
  userProfile: UserProfile | null;
  onNavigateToCaseBoard: () => void;
  onNavigateToCustomCases: () => void;
  onNavigateToChallengeBoard: () => void;
  onPlayFeaturedCase: (caseId: string) => void;
  onOpenSettings: () => void;
  onOpenAdmin?: () => void;
}

export default function LandingPage({ userProfile, onNavigateToCaseBoard, onNavigateToCustomCases, onNavigateToChallengeBoard, onPlayFeaturedCase, onOpenSettings, onOpenAdmin }: LandingPageProps) {
  const { signOut } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="https://assets.mixkit.co/videos/preview/mixkit-lawyer-reading-a-document-in-his-office-4615-large.mp4" type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/92 via-slate-950/88 to-slate-950/95" />
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-950/20 via-transparent to-red-950/10" />

      {/* Ambient floating gavel/scale accents for game energy */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="absolute opacity-[0.06] animate-float"
            style={{
              left: `${10 + i * 25}%`,
              top: `${15 + (i % 2) * 50}%`,
              animationDelay: `${i * 1.3}s`,
              animationDuration: `${12 + i * 3}s`
            }}
          >
            <Gavel className="w-24 h-24 text-amber-400" />
          </div>
        ))}
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="p-4 sm:p-6">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-500 to-red-600 rounded-full shadow-lg shadow-amber-900/50">
                <Gavel className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white leading-none">Courtroom Quest</h1>
                <p className="text-amber-400/80 text-[10px] sm:text-xs font-medium tracking-wide mt-0.5">EVERY CASE HAS A LOOPHOLE</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {userProfile && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span className="text-white text-sm font-semibold">{userProfile.wins_count}</span>
                  <span className="text-white/40 text-xs">wins</span>
                  <span className="text-white/20">·</span>
                  <span className="text-white/70 text-xs font-medium">{userProfile.current_level}</span>
                </div>
              )}
              {onOpenAdmin && (
                <button
                  onClick={onOpenAdmin}
                  className="px-3 sm:px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Admin
                </button>
              )}
              <button
                onClick={onOpenSettings}
                className="flex items-center justify-center w-10 h-10 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors"
                title="Settings"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
              <button
                onClick={signOut}
                className="px-3 sm:px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-6">
          <div className="max-w-3xl w-full space-y-6 sm:space-y-8">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full">
                <Flame className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-300 text-xs font-bold tracking-wide">FIND THE ARGUMENT NOBODY SAW COMING</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
                Every case has a loophole.
                <br />
                <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                  Find it. Argue it. Win the court.
                </span>
              </h2>
            </div>

            <div>
              <CaseOfTheWeek onPlayCase={onPlayFeaturedCase} />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-white/10" />
              <p className="text-slate-400 text-sm whitespace-nowrap">or choose your path</p>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
              <button
                onClick={onNavigateToCaseBoard}
                className="group relative bg-slate-800/60 backdrop-blur-md border-2 border-slate-700 hover:border-blue-500 rounded-2xl p-6 sm:p-8 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/20"
              >
                <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4">
                  <div className="p-3 sm:p-4 bg-blue-600 rounded-full group-hover:bg-blue-500 transition-colors">
                    <Briefcase className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-1 sm:mb-2">
                      Clients Seeking Legal Representation
                    </h3>
                    <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                      Take on real cases. Investigate. Argue. Win.
                    </p>
                  </div>
                  <div className="mt-3 sm:mt-4 px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 group-hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors text-sm sm:text-base">
                    Go to Case Board
                  </div>
                </div>
              </button>

              <button
                onClick={onNavigateToCustomCases}
                className="group relative bg-slate-800/60 backdrop-blur-md border-2 border-slate-700 hover:border-purple-500 rounded-2xl p-6 sm:p-8 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/20"
              >
                <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4">
                  <div className="p-3 sm:p-4 bg-purple-600 rounded-full group-hover:bg-purple-500 transition-colors">
                    <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-1 sm:mb-2">
                      Create Your Own Case
                    </h3>
                    <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                      Simulate a custom trial with your own evidence and witnesses.
                    </p>
                  </div>
                  <div className="mt-4 px-6 py-3 bg-purple-600 group-hover:bg-purple-500 text-white font-semibold rounded-lg transition-colors">
                    Proceed to Custom Cases
                  </div>
                </div>
              </button>

              <button
                onClick={onNavigateToChallengeBoard}
                className="group relative bg-slate-800/60 backdrop-blur-md border-2 border-slate-700 hover:border-amber-500 rounded-2xl p-6 sm:p-8 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-amber-500/20"
              >
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-red-600 rounded-full text-white text-[10px] font-bold tracking-wide">
                  LIVE 1V1
                </div>
                <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4">
                  <div className="p-3 sm:p-4 bg-amber-600 rounded-full group-hover:bg-amber-500 transition-colors">
                    <Swords className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-1 sm:mb-2">
                      Challenge Another Player
                    </h3>
                    <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                      Pick a side, open a challenge, and face a real opponent — no AI counsel.
                    </p>
                  </div>
                  <div className="mt-4 px-6 py-3 bg-amber-600 group-hover:bg-amber-500 text-white font-semibold rounded-lg transition-colors">
                    Go to Challenge Board
                  </div>
                </div>
              </button>
            </div>
          </div>
        </main>

        <footer className="p-6 text-center">
          <p className="text-slate-500 text-sm font-medium tracking-wide">Every case has a loophole. Can you find it?</p>
        </footer>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-24px) rotate(-6deg); }
        }
        .animate-float {
          animation: float 14s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
