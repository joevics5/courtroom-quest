import { createContext, useContext, useState, ReactNode } from 'react';
import type { CaseSession, CaseWithDetails, SessionWithDetails } from '../types';

interface SessionContextType {
  currentSession: SessionWithDetails | null;
  currentCase: CaseWithDetails | null;
  setCurrentSession: (session: SessionWithDetails | null) => void;
  setCurrentCase: (caseData: CaseWithDetails | null) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [currentSession, setCurrentSession] = useState<SessionWithDetails | null>(null);
  const [currentCase, setCurrentCase] = useState<CaseWithDetails | null>(null);

  const clearSession = () => {
    setCurrentSession(null);
    setCurrentCase(null);
  };

  return (
    <SessionContext.Provider
      value={{
        currentSession,
        currentCase,
        setCurrentSession,
        setCurrentCase,
        clearSession
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
