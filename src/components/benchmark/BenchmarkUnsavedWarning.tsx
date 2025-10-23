import { useEffect } from 'react';

interface BenchmarkUnsavedWarningProps {
  hasUnsavedChanges: boolean;
}

export const BenchmarkUnsavedWarning = ({ hasUnsavedChanges }: BenchmarkUnsavedWarningProps) => {
  // Avertissement natif du navigateur lors de la fermeture de la page
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome nécessite returnValue à définir
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Note: Blocage des navigations internes React Router nécessite un data router
  // Pour l'instant, on se contente de l'avertissement beforeunload

  return null;
};

