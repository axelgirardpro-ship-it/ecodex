import { createContext, useContext, useState, ReactNode } from 'react';

interface SSOState {
  loading: {
    google: boolean;
  };
  lastError: string | null;
}

interface SSOContextType {
  ssoState: SSOState;
  setProviderLoading: (provider: keyof SSOState['loading'], loading: boolean) => void;
  setLastError: (error: string | null) => void;
  clearError: () => void;
}

const SSOContext = createContext<SSOContextType | undefined>(undefined);

export const useSSO = () => {
  const context = useContext(SSOContext);
  if (!context) {
    throw new Error('useSSO must be used within an SSOProvider');
  }
  return context;
};

interface SSOProviderProps {
  children: ReactNode;
}

export const SSOProvider = ({ children }: SSOProviderProps) => {
  const [ssoState, setSsoState] = useState<SSOState>({
    loading: {
      google: false,
    },
    lastError: null,
  });

  const setProviderLoading = (provider: keyof SSOState['loading'], loading: boolean) => {
    setSsoState(prev => ({
      ...prev,
      loading: {
        ...prev.loading,
        [provider]: loading,
      },
    }));
  };

  const setLastError = (error: string | null) => {
    setSsoState(prev => ({
      ...prev,
      lastError: error,
    }));
  };

  const clearError = () => {
    setLastError(null);
  };

  return (
    <SSOContext.Provider value={{
      ssoState,
      setProviderLoading,
      setLastError,
      clearError,
    }}>
      {children}
    </SSOContext.Provider>
  );
};