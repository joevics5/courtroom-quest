import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import AppDialogHost from './components/AppDialogHost.tsx';
import AppErrorBoundary from './components/AppErrorBoundary.tsx';
import { installGlobalErrorReporting } from './lib/errorReporting';
import './index.css';

installGlobalErrorReporting();

const SharedTranscript = lazy(() => import('./components/SharedTranscript.tsx'));
const WatchBoard = lazy(() => import('./components/WatchBoard.tsx'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={null}>
        <Routes>
          <Route path="/share/:sessionId" element={<SharedTranscript />} />
          <Route path="/watch" element={<WatchBoard />} />
          <Route path="/*" element={<App />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      <AppDialogHost />
    </AppErrorBoundary>
  </StrictMode>
);
