// Système de throttling et debouncing intelligent
export interface ThrottleConfig {
  maxRequestsPerSecond: number;
  maxRequestsPerMinute: number;
  burstAllowance: number;
  adaptiveThrottling: boolean;
}

export interface DebounceConfig {
  baseDelay: number;
  maxDelay: number;
  adaptiveDelay: boolean;
  cancelOnNewRequest: boolean;
}

export class SmartThrottling {
  private requestTimestamps: number[] = [];
  private burstTokens: number;
  private lastRequestTime = 0;
  private consecutiveRequests = 0;
  private readonly config: ThrottleConfig;

  constructor(config: Partial<ThrottleConfig> = {}) {
    this.config = {
      maxRequestsPerSecond: 5,
      maxRequestsPerMinute: 60,
      burstAllowance: 10,
      adaptiveThrottling: true,
      ...config
    };
    this.burstTokens = this.config.burstAllowance;
  }

  async throttle<T>(request: () => Promise<T>): Promise<T> {
    const now = Date.now();
    
    // Nettoyer les anciens timestamps
    this.cleanOldTimestamps(now);
    
    // Calculer le délai nécessaire
    const delay = this.calculateDelay(now);
    
    if (delay > 0) {
      await this.sleep(delay);
    }
    
    // Enregistrer la requête
    this.recordRequest(now + delay);
    
    // Exécuter la requête
    try {
      const result = await request();
      this.consecutiveRequests++;
      return result;
    } catch (error) {
      // Reset en cas d'erreur
      this.consecutiveRequests = 0;
      throw error;
    }
  }

  private calculateDelay(now: number): number {
    const secondAgo = now - 1000;
    const minuteAgo = now - 60000;
    
    const requestsLastSecond = this.requestTimestamps.filter(ts => ts > secondAgo).length;
    const requestsLastMinute = this.requestTimestamps.filter(ts => ts > minuteAgo).length;
    
    // Vérifier les limites par seconde
    if (requestsLastSecond >= this.config.maxRequestsPerSecond) {
      // Utiliser les tokens de burst si disponibles
      if (this.burstTokens > 0) {
        this.burstTokens--;
        return 0;
      }
      
      // Sinon calculer le délai
      const oldestRecentRequest = this.requestTimestamps
        .filter(ts => ts > secondAgo)
        .sort()[0];
      return Math.max(0, 1000 - (now - oldestRecentRequest));
    }
    
    // Vérifier les limites par minute
    if (requestsLastMinute >= this.config.maxRequestsPerMinute) {
      const oldestMinuteRequest = this.requestTimestamps
        .filter(ts => ts > minuteAgo)
        .sort()[0];
      return Math.max(0, 60000 - (now - oldestMinuteRequest));
    }
    
    // Throttling adaptatif basé sur l'usage récent
    if (this.config.adaptiveThrottling && this.consecutiveRequests > 10) {
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < 100) {
        return 100 - timeSinceLastRequest; // Force un délai minimum
      }
    }
    
    return 0;
  }

  private cleanOldTimestamps(now: number) {
    const minuteAgo = now - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > minuteAgo);
    
    // Régénérer les tokens de burst
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest > 5000) { // 5 secondes de pause
      this.burstTokens = Math.min(
        this.config.burstAllowance,
        this.burstTokens + Math.floor(timeSinceLastRequest / 1000)
      );
      this.consecutiveRequests = 0;
    }
  }

  private recordRequest(timestamp: number) {
    this.requestTimestamps.push(timestamp);
    this.lastRequestTime = timestamp;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    const now = Date.now();
    const secondAgo = now - 1000;
    const minuteAgo = now - 60000;
    
    return {
      requestsLastSecond: this.requestTimestamps.filter(ts => ts > secondAgo).length,
      requestsLastMinute: this.requestTimestamps.filter(ts => ts > minuteAgo).length,
      burstTokensAvailable: this.burstTokens,
      consecutiveRequests: this.consecutiveRequests,
      config: this.config
    };
  }
}

export class AdaptiveDebouncer {
  private timers = new Map<string, NodeJS.Timeout>();
  private requestCounts = new Map<string, number>();
  private config: DebounceConfig;

  constructor(config: Partial<DebounceConfig> = {}) {
    this.config = {
      baseDelay: 300,
      maxDelay: 1000,
      adaptiveDelay: true,
      cancelOnNewRequest: true,
      ...config
    };
  }

  debounce<T>(
    key: string,
    fn: () => Promise<T> | T,
    customDelay?: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Annuler le timer précédent si configuré
      if (this.config.cancelOnNewRequest && this.timers.has(key)) {
        clearTimeout(this.timers.get(key)!);
        this.timers.delete(key);
      }

      // Calculer le délai adaptatif
      const delay = customDelay || this.calculateAdaptiveDelay(key);
      
      // Incrémenter le compteur de requêtes pour cette clé
      this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);

      // Créer le nouveau timer
      const timer = setTimeout(async () => {
        this.timers.delete(key);
        this.requestCounts.delete(key);
        
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);

      this.timers.set(key, timer);
    });
  }

  private calculateAdaptiveDelay(key: string): number {
    if (!this.config.adaptiveDelay) {
      return this.config.baseDelay;
    }

    const requestCount = this.requestCounts.get(key) || 0;
    
    // Plus il y a de requêtes consécutives, plus le délai augmente
    const multiplier = Math.min(1 + (requestCount * 0.2), 3);
    const adaptedDelay = this.config.baseDelay * multiplier;
    
    return Math.min(adaptedDelay, this.config.maxDelay);
  }

  // Debouncing spécialisé pour les requêtes de recherche
  debounceSearch(
    query: string,
    fn: () => Promise<any> | any,
    context: { isTyping?: boolean; hasFilters?: boolean } = {}
  ): Promise<any> {
    const { isTyping = false, hasFilters = false } = context;
    
    // Délai adaptatif basé sur le contexte
    let delay = this.config.baseDelay;
    
    if (query.length < 3) {
      delay = 150; // Délai court pour les requêtes courtes
    } else if (query.length > 6 && hasFilters) {
      delay = 500; // Délai plus long pour les requêtes complexes
    } else if (isTyping) {
      delay = 200; // Délai court quand l'utilisateur tape
    }
    
    const key = `search:${query}:${hasFilters}`;
    return this.debounce(key, fn, delay);
  }

  // Nettoyage manuel
  clear(key?: string) {
    if (key) {
      const timer = this.timers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(key);
        this.requestCounts.delete(key);
      }
    } else {
      // Nettoyer tout
      for (const timer of this.timers.values()) {
        clearTimeout(timer);
      }
      this.timers.clear();
      this.requestCounts.clear();
    }
  }

  getStats() {
    return {
      activeTimers: this.timers.size,
      totalRequests: Array.from(this.requestCounts.values()).reduce((a, b) => a + b, 0),
      requestsByKey: Object.fromEntries(this.requestCounts),
      config: this.config
    };
  }
}

// Classe combinée pour gestion complète des requêtes
export class SmartRequestManager {
  private throttler: SmartThrottling;
  private debouncer: AdaptiveDebouncer;
  private requestQueue: Array<{ fn: Function; resolve: Function; reject: Function; priority: number }> = [];
  private processing = false;

  constructor(
    throttleConfig?: Partial<ThrottleConfig>,
    debounceConfig?: Partial<DebounceConfig>
  ) {
    this.throttler = new SmartThrottling(throttleConfig);
    this.debouncer = new AdaptiveDebouncer(debounceConfig);
  }

  // Requête optimisée avec priorité
  async optimizedRequest<T>(
    key: string,
    fn: () => Promise<T>,
    options: {
      debounce?: boolean;
      throttle?: boolean;
      priority?: number;
      context?: any;
    } = {}
  ): Promise<T> {
    const {
      debounce = true,
      throttle = true,
      priority = 2,
      context = {}
    } = options;

    let requestFn = fn;

    // Appliquer le throttling si demandé
    if (throttle) {
      const originalFn = requestFn;
      requestFn = () => this.throttler.throttle(originalFn);
    }

    // Appliquer le debouncing si demandé
    if (debounce) {
      return this.debouncer.debounceSearch(key, requestFn, context);
    }

    // Ajouter à la queue avec priorité
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ fn: requestFn, resolve, reject, priority });
      this.requestQueue.sort((a, b) => a.priority - b.priority);
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.requestQueue.length === 0) return;
    
    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      const { fn, resolve, reject } = this.requestQueue.shift()!;
      
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
    
    this.processing = false;
  }

  getStats() {
    return {
      throttler: this.throttler.getStats(),
      debouncer: this.debouncer.getStats(),
      queueSize: this.requestQueue.length,
      processing: this.processing
    };
  }

  clear() {
    this.debouncer.clear();
    this.requestQueue = [];
    this.processing = false;
  }
}

// Instances globales
export const globalThrottler = new SmartThrottling();
export const globalDebouncer = new AdaptiveDebouncer();
export const smartRequestManager = new SmartRequestManager();
