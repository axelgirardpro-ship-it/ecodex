import { useEffect } from 'react';

interface BenchmarkUnsavedWarningProps {
  hasUnsavedChanges: boolean;
}

export const BenchmarkUnsavedWarning = ({ hasUnsavedChanges }: BenchmarkUnsavedWarningProps) => {
  // Bloquer fermeture/refresh navigateur et tentatives de navigation
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    // Intercepter les clics sur les liens internes
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      
      if (link && link.href && !link.href.startsWith('http://') && !link.href.startsWith('https://')) {
        // C'est un lien interne
        const confirmed = window.confirm(
          'Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter cette page ?'
        );
        if (!confirmed) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    // Intercepter le bouton retour du navigateur
    const handlePopState = (e: PopStateEvent) => {
      const confirmed = window.confirm(
        'Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter cette page ?'
      );
      if (!confirmed) {
        // Repousser l'état pour annuler la navigation
        window.history.pushState(null, '', window.location.href);
      }
    };

    // Ajouter un état dans l'historique pour détecter le retour
    window.history.pushState(null, '', window.location.href);

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasUnsavedChanges]);

  return null;
};

