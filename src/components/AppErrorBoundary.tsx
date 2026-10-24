import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PANEL, gameButton } from './ui';
import { reportError } from '@/lib/errorReporting';

interface State { failed: boolean }

/** If a screen crashes, show a proper in-game screen instead of a blank white page. */
export default class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack);
    void reportError(error, 'screen-crash');
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="min-h-[100dvh] bg-[#05060a] flex items-center justify-center p-4">
        <div className={`${PANEL} !bg-[#14161f] w-full max-w-sm text-center`}>
          <div className="mx-auto w-14 h-14 rounded-full border-2 flex items-center justify-center bg-red-500/20 border-red-400/50 text-red-300">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="logo-gold font-game text-4xl leading-none mt-4">MISTRIAL</h1>
          <p className="text-white/80 leading-relaxed mt-3 mb-6">
            Something went wrong on this screen. Your games are saved, so you can pick up where you left off.
          </p>
          <div className="grid gap-3">
            <button type="button" onClick={() => window.location.reload()} className={gameButton('gold', 'md')}>RELOAD</button>
            <button type="button" onClick={() => window.location.assign('/')} className={gameButton('ghost', 'md')}>BACK TO HOME</button>
          </div>
        </div>
      </div>
    );
  }
}
