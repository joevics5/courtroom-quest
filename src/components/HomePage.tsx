import { useState, useEffect } from 'react';
import { Scale, Gavel, BookOpen, Users, ArrowRight, Play } from 'lucide-react';

interface HomePageProps {
  onSignIn: () => void;
}

export default function HomePage({ onSignIn }: HomePageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Video URL - you can replace this with your video URL or use a local asset
  const videoUrl = '/videos/courtroom-background.mp4'; // Replace with your video URL or path

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900">
      {/* Video Background */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-30"
          poster="/images/courtroom-poster.jpg" // Fallback image if video fails
        >
          <source src={videoUrl} type="video/mp4" />
          {/* Fallback gradient if video doesn't load */}
        </video>
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-transparent to-purple-900/20" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="container mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg shadow-blue-500/50">
                <Scale className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                Courtroom
                <span className="text-blue-400"> Simulator</span>
              </h1>
            </div>
            <button
              onClick={onSignIn}
              className="px-4 py-2 sm:px-6 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50"
            >
              Sign In
            </button>
          </nav>
        </header>

        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className={`max-w-6xl mx-auto transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {/* Hero Section */}
            <div className="text-center mb-12 sm:mb-16 lg:mb-20">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-full mb-6 sm:mb-8">
                <Play className="w-4 h-4 text-blue-400" />
                <span className="text-sm sm:text-base text-blue-300 font-medium">Experience Realistic Courtroom Drama</span>
              </div>
              
              <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-4 sm:mb-6 leading-tight">
                Master the Art of
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Legal Strategy
                </span>
              </h2>
              
              <p className="text-lg sm:text-xl lg:text-2xl text-slate-300 max-w-3xl mx-auto mb-8 sm:mb-12 leading-relaxed">
                Build your case, question witnesses, present evidence, and argue before the jury.
                <br className="hidden sm:block" />
                Every decision matters. Every word counts.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
                <button
                  onClick={onSignIn}
                  className="group px-8 py-4 sm:px-10 sm:py-5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg sm:text-xl transition-all hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50 flex items-center gap-3"
                >
                  Start Playing
                  <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={onSignIn}
                  className="px-8 py-4 sm:px-10 sm:py-5 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600 text-white rounded-xl font-semibold text-lg sm:text-xl transition-all hover:scale-105 backdrop-blur-sm"
                >
                  Learn More
                </button>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12 sm:mb-16">
              {/* Feature 1 */}
              <div className="group bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 sm:p-8 hover:border-blue-500/50 transition-all hover:scale-105 hover:shadow-xl hover:shadow-blue-500/20">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                  <Gavel className="w-7 h-7 sm:w-8 sm:h-8 text-blue-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Real Courtroom Experience</h3>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                  Navigate through authentic trial procedures, from opening statements to closing arguments.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="group bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 sm:p-8 hover:border-purple-500/50 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                  <Users className="w-7 h-7 sm:w-8 sm:h-8 text-purple-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">AI-Powered Witnesses</h3>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                  Interview witnesses with advanced AI that responds based on their knowledge and testimony.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="group bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 sm:p-8 hover:border-pink-500/50 transition-all hover:scale-105 hover:shadow-xl hover:shadow-pink-500/20 md:col-span-2 lg:col-span-1">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-pink-500/20 to-pink-600/20 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-pink-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Build Your Case</h3>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                  Create custom cases with unique evidence, witnesses, and legal challenges.
                </p>
              </div>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {[
                { label: 'Cases Won', value: '10K+', gradient: 'from-blue-400 to-blue-600' },
                { label: 'Active Players', value: '50K+', gradient: 'from-purple-400 to-purple-600' },
                { label: 'Custom Cases', value: '5K+', gradient: 'from-pink-400 to-pink-600' },
                { label: 'Court Sessions', value: '100K+', gradient: 'from-cyan-400 to-cyan-600' }
              ].map((stat, index) => (
                <div
                  key={index}
                  className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/30 rounded-xl p-4 sm:p-6 text-center hover:border-slate-600/50 transition-all"
                >
                  <div className={`text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-slate-800/50 backdrop-blur-sm bg-slate-900/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Scale className="w-5 h-5 text-blue-400" />
                <span className="text-slate-400 text-sm sm:text-base">© 2024 Courtroom Simulator</span>
              </div>
              <div className="flex items-center gap-6 text-sm text-slate-400">
                <a href="#" className="hover:text-white transition-colors">Privacy</a>
                <a href="#" className="hover:text-white transition-colors">Terms</a>
                <a href="#" className="hover:text-white transition-colors">Support</a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Floating legal documents */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute opacity-10 animate-float"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 30}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${10 + i * 2}s`
            }}
          >
            <BookOpen className="w-16 h-16 sm:w-20 sm:h-20 text-blue-400" />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        .animate-float {
          animation: float 10s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

