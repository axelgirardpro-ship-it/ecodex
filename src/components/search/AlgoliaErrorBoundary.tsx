import React, { Component, ReactNode } from 'react';
import SearchPageFallback from './SearchPageFallback';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AlgoliaErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Gérer toutes les erreurs dans le contexte de recherche
    const errorWithStatus = error as Error & { status?: number };
    const isSearchRelatedError = error.message?.includes('blocked') || 
                                 error.message?.includes('Algolia') ||
                                 error.message?.includes('length') ||
                                 error.message?.includes('Cannot read properties') ||
                                 error.stack?.includes('SearchBox') ||
                                 error.stack?.includes('SmartSuggestions') ||
                                 errorWithStatus.status === 403;
    
    return { 
      hasError: isSearchRelatedError, 
      error: isSearchRelatedError ? error : null 
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // Logger l'erreur pour debug
    const errorWithStatus = error as Error & { status?: number };
    const isSearchRelatedError = error.message?.includes('blocked') || 
                                 error.message?.includes('Algolia') ||
                                 error.message?.includes('length') ||
                                 error.message?.includes('Cannot read properties') ||
                                 error.stack?.includes('SearchBox') ||
                                 error.stack?.includes('SmartSuggestions') ||
                                 errorWithStatus.status === 403;
    
    if (isSearchRelatedError) {
      console.log('ℹ️ Erreur liée à la recherche gérée gracieusement:', error.message);
    } else {
      console.error('Error boundary caught an error:', error, errorInfo);
      // Pour les erreurs non liées à la recherche, ne pas rethrower
      // Laisser l'error boundary les gérer
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Déterminer quel type de fallback utiliser
      const errorWithStatus = this.state.error as Error & { status?: number };
      const isAlgoliaSpecific = this.state.error.message?.includes('blocked') || 
                               this.state.error.message?.includes('Algolia') ||
                               errorWithStatus.status === 403;
      
      // Utiliser un fallback unique et cohérent pour toutes les erreurs de recherche
      return (
        <SearchPageFallback 
          error={this.state.error.message}
          onRetry={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}

export default AlgoliaErrorBoundary;
