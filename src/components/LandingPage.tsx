import { Scale, Briefcase, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LandingPageProps {
  onNavigateToCaseBoard: () => void;
  onNavigateToCustomCases: () => void;
  onOpenAdmin?: () => void;
}

export default function LandingPage({ onNavigateToCaseBoard, onNavigateToCustomCases, onOpenAdmin }: LandingPageProps) {
  const { signOut } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="https://assets.mixkit.co/videos/preview/mixkit-lawyer-reading-a-document-in-his-office-4615-large.mp4" type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-900/85 to-slate-900/90" />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="p-4 sm:p-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-full">
                <Scale className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">AI Courtroom</h1>
            </div>
            <div className="flex items-center gap-3">
              {onOpenAdmin && (
                <button
                  onClick={onOpenAdmin}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm"
                >
                  Admin
                </button>
              )}
              <button
                onClick={signOut}
                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm backdrop-blur-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 sm:px-6">
          <div className="max-w-3xl w-full space-y-6 sm:space-y-8">
            <div className="text-center space-y-3 sm:space-y-4 mb-8 sm:mb-12">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
                Welcome to the Courtroom
              </h2>
              <p className="text-lg sm:text-xl text-slate-300">
                Choose your path
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
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
            </div>
          </div>
        </main>

        <footer className="p-6 text-center text-slate-400 text-sm">
          <p>Professional legal simulation platform</p>
        </footer>
      </div>
    </div>
  );
}
