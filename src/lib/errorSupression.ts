// Utilitaire pour supprimer temporairement les logs d'erreur répétitifs
// À utiliser pendant la résolution des problèmes Supabase

interface ErrorLog {
  timestamp: number;
  count: number;
}

class ErrorSuppressor {
  private static instance: ErrorSuppressor;
  private errorCounts: Map<string, ErrorLog> = new Map();
  private readonly maxLogsPerError = 1;
  private readonly timeWindow = 300000; // 5 minutes

  static getInstance(): ErrorSuppressor {
    if (!ErrorSuppressor.instance) {
      ErrorSuppressor.instance = new ErrorSuppressor();
    }
    return ErrorSuppressor.instance;
  }

  shouldLog(errorKey: string): boolean {
    const now = Date.now();
    const errorLog = this.errorCounts.get(errorKey);

    if (!errorLog) {
      this.errorCounts.set(errorKey, { timestamp: now, count: 1 });
      return true;
    }

    // Reset count if time window has passed
    if (now - errorLog.timestamp > this.timeWindow) {
      this.errorCounts.set(errorKey, { timestamp: now, count: 1 });
      return true;
    }

    // Don't log if we've already logged this error too many times
    if (errorLog.count >= this.maxLogsPerError) {
      return false;
    }

    errorLog.count++;
    return false;
  }

  suppressSupabaseErrors(): void {
    // Intercepter les console.error pour Supabase
    const originalError = console.error;
    
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      
      // Identifier les erreurs Supabase répétitives
      if (message.includes('Error fetching user profile') ||
          message.includes('500 (Internal Server Error)') ||
          message.includes('wrodvaatdujbpfpvrzge.supabase.co')) {
        
        const errorKey = this.generateErrorKey(message);
        if (!this.shouldLog(errorKey)) {
          return; // Supprimer le log
        }
      }
      
      // Laisser passer les autres erreurs
      originalError.apply(console, args);
    };
  }

  private generateErrorKey(message: string): string {
    // Générer une clé unique pour le type d'erreur
    if (message.includes('Error fetching user profile')) {
      return 'supabase_user_profile_error';
    }
    if (message.includes('500 (Internal Server Error)')) {
      return 'supabase_500_error';
    }
    if (message.includes('wrodvaatdujbpfpvrzge.supabase.co')) {
      return 'supabase_general_error';
    }
    return 'unknown_error';
  }

  getErrorStats(): Record<string, ErrorLog> {
    const stats: Record<string, ErrorLog> = {};
    this.errorCounts.forEach((value, key) => {
      stats[key] = value;
    });
    return stats;
  }

  clearErrorCounts(): void {
    this.errorCounts.clear();
  }
}

// Fonction helper pour initier la suppression
export function initErrorSuppression(): void {
  if (import.meta.env.DEV) {
    const suppressor = ErrorSuppressor.getInstance();
    suppressor.suppressSupabaseErrors();
    
    // Filtrer certaines erreurs de navigateurs/extensions très bruyantes
    if (typeof window !== 'undefined') {
      const isExtensionPortError = (msg: string) => {
        const lower = (msg || '').toLowerCase();
        return lower.includes('disconnected port object');
      };

      // Empêcher l'affichage d'erreurs non actionnables (extensions)
      window.addEventListener('error', (ev: ErrorEvent) => {
        const msg = String(ev.message || '');
        if (isExtensionPortError(msg)) {
          ev.preventDefault?.();
        }
      });

      // Eviter les Uncaught (in promise) pour Algolia bloqué
      window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
        const reason: any = ev.reason;
        const msg = String(reason?.message || reason || '').toLowerCase();
        if (msg.includes('application is blocked') || msg.includes('forbidden') || msg.includes('blocked')) {
          ev.preventDefault?.();
        }
      });
    }
    
    // Ajouter aux outils de debug
    if (typeof window !== 'undefined') {
      (window as Record<string, unknown>).errorSuppressor = {
        getStats: () => suppressor.getErrorStats(),
        clear: () => suppressor.clearErrorCounts()
      };
    }
    
    console.log('🔇 Suppression des erreurs répétitives activée (développement)');
  }
}

export { ErrorSuppressor };
