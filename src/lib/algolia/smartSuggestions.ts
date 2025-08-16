// Système de suggestions intelligent avec cache préfixe
import { Origin } from './searchClient';
import { createUnifiedClient } from './unifiedSearchClient';
import { smartRequestManager } from './smartThrottling';

export interface SuggestionItem {
  label: string;
  isPrivate: boolean;
  source?: string;
  objectID?: string;
  relevanceScore?: number;
  category?: string;
}

interface PrefixCacheEntry {
  prefix: string;
  suggestions: SuggestionItem[];
  timestamp: number;
  totalCount: number;
  isComplete: boolean; // true si toutes les suggestions pour ce préfixe sont cachées
}

interface SuggestionContext {
  workspaceId?: string;
  assignedSources?: string[];
  userLanguage?: string;
  recentSearches?: string[];
  origin: Origin;
}

export class SmartSuggestionManager {
  private prefixCache = new Map<string, PrefixCacheEntry>();
  private recentSearchCache = new Map<string, string[]>();
  private readonly maxCacheSize = 500;
  private readonly prefixCacheTTL = 10 * 60 * 1000; // 10 minutes
  private readonly minPrefixLength = 1;
  private readonly maxSuggestions = 8;
  private client: any = null;
  private context: SuggestionContext | null = null;

  constructor() {
    this.startCacheCleanup();
  }

  updateContext(context: SuggestionContext) {
    if (this.contextChanged(context)) {
      // Contexte changé, nettoyer le cache
      this.prefixCache.clear();
      
      // Recréer le client si nécessaire
      if (this.client) {
        this.client.dispose();
      }
      this.client = createUnifiedClient(context.workspaceId, context.assignedSources);
    }
    
    this.context = context;
  }

  private contextChanged(newContext: SuggestionContext): boolean {
    if (!this.context) return true;
    
    return this.context.workspaceId !== newContext.workspaceId ||
           this.context.origin !== newContext.origin ||
           JSON.stringify(this.context.assignedSources) !== JSON.stringify(newContext.assignedSources);
  }

  async getSuggestions(
    query: string,
    maxResults: number = this.maxSuggestions
  ): Promise<SuggestionItem[]> {
    if (!this.context || !this.client) {
      throw new Error('Context not initialized. Call updateContext() first.');
    }

    const trimmedQuery = query.trim();
    
    // Requête vide = suggestions récentes
    if (trimmedQuery.length === 0) {
      return this.getRecentSearchSuggestions();
    }

    // Requête trop courte pour cache préfixe
    if (trimmedQuery.length < this.minPrefixLength) {
      return this.fetchDirectSuggestions(trimmedQuery, maxResults);
    }

    // Chercher dans le cache par préfixe
    const cachedSuggestions = this.findCachedSuggestions(trimmedQuery, maxResults);
    if (cachedSuggestions) {
      return cachedSuggestions;
    }

    // Fetch nouvelles suggestions avec optimisation préfixe
    return this.fetchAndCacheSuggestions(trimmedQuery, maxResults);
  }

  private findCachedSuggestions(query: string, maxResults: number): SuggestionItem[] | null {
    // Chercher le préfixe le plus long qui match
    let bestMatch: PrefixCacheEntry | null = null;
    let bestPrefixLength = 0;

    for (const [prefix, entry] of this.prefixCache.entries()) {
      if (query.startsWith(prefix) && prefix.length > bestPrefixLength) {
        // Vérifier si l'entrée est encore valide
        if (Date.now() - entry.timestamp <= this.prefixCacheTTL) {
          bestMatch = entry;
          bestPrefixLength = prefix.length;
        } else {
          // Nettoyer l'entrée expirée
          this.prefixCache.delete(prefix);
        }
      }
    }

    if (!bestMatch) return null;

    // Filtrer les suggestions qui matchent la requête complète
    const filtered = bestMatch.suggestions.filter(suggestion =>
      suggestion.label.toLowerCase().includes(query.toLowerCase())
    );

    // Si on a assez de résultats ou si le cache est complet pour ce préfixe
    if (filtered.length >= maxResults || bestMatch.isComplete) {
      return this.rankSuggestions(filtered, query).slice(0, maxResults);
    }

    return null; // Pas assez de résultats, faire une vraie recherche
  }

  private async fetchAndCacheSuggestions(
    query: string,
    maxResults: number
  ): Promise<SuggestionItem[]> {
    // Déterminer le préfixe optimal pour le cache
    const prefixLength = Math.min(query.length, 3);
    const prefix = query.substring(0, prefixLength);

    const key = `suggestions:${prefix}:${this.context!.origin}`;
    
    const suggestions = await smartRequestManager.optimizedRequest(
      key,
      () => this.fetchDirectSuggestions(query, maxResults * 2), // Fetch plus pour le cache
      {
        debounce: true,
        throttle: true,
        priority: 1,
        context: {
          isTyping: true,
          hasFilters: false
        }
      }
    );

    // Mettre en cache avec le préfixe
    this.cacheByPrefix(prefix, suggestions, query);

    return this.rankSuggestions(suggestions, query).slice(0, maxResults);
  }

  private async fetchDirectSuggestions(
    query: string,
    maxResults: number
  ): Promise<SuggestionItem[]> {
    const { origin } = this.context!;
    
    const suggestions: SuggestionItem[] = [];
    const seenLabels = new Set<string>();

    try {
      const requests = [];

      // Construire les requêtes selon l'origine
      if (origin === 'all' || origin === 'public') {
        requests.push({
          params: {
            query,
            hitsPerPage: maxResults,
            attributesToRetrieve: ['Nom_fr', 'Nom_en', 'Description_fr', 'Description_en', 'Source', 'Secteur_fr', 'Secteur_en'],
            restrictSearchableAttributes: ['Nom_fr', 'Nom_en', 'Description_fr', 'Description_en', 'Secteur_fr', 'Secteur_en'],
            facetFilters: [['scope:public']],
            typoTolerance: 'strict'
          },
          origin: 'public' as Origin
        });
      }

      if (origin === 'all' || origin === 'private') {
        requests.push({
          params: {
            query,
            hitsPerPage: maxResults,
            attributesToRetrieve: ['Nom_fr', 'Nom_en', 'Description_fr', 'Description_en', 'Source', 'Secteur_fr', 'Secteur_en'],
            restrictSearchableAttributes: ['Nom_fr', 'Nom_en', 'Description_fr', 'Description_en', 'Secteur_fr', 'Secteur_en'],
            facetFilters: [['scope:private']],
            typoTolerance: 'strict'
          },
          origin: 'private' as Origin
        });
      }

      if (requests.length === 0) return [];

      const results = await this.client.search(requests, {
        enableCache: true,
        enableDeduplication: true,
        enableBatching: false // Pas de batching pour les suggestions
      });

      // Traiter les résultats
      for (const result of results.results) {
        if (!result?.hits) continue;

        for (const hit of result.hits) {
          const label = hit.Nom_fr || hit.Nom_en || '';
          if (!label || seenLabels.has(label)) continue;

          seenLabels.add(label);
          
          const suggestion: SuggestionItem = {
            label,
            isPrivate: hit.scope === 'private',
            source: hit.Source,
            objectID: hit.objectID,
            relevanceScore: this.calculateRelevanceScore(hit, query),
            category: hit.Secteur_fr || hit.Secteur_en || 'Autres'
          };

          suggestions.push(suggestion);
        }
      }

      return suggestions;

    } catch (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }
  }

  private calculateRelevanceScore(hit: any, query: string): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Score basé sur la correspondance du nom
    const nom = (hit.Nom_fr || hit.Nom_en || '').toLowerCase();
    if (nom.startsWith(queryLower)) score += 100;
    else if (nom.includes(queryLower)) score += 50;

    // Score basé sur la description
    const desc = (hit.Description_fr || hit.Description_en || '').toLowerCase();
    if (desc.includes(queryLower)) score += 25;

    // Bonus pour les sources populaires (heuristique)
    const popularSources = ['ADEME', 'Base Carbone', 'GHG Protocol'];
    if (popularSources.includes(hit.Source)) score += 10;

    // Malus pour les résultats privés si on cherche en public
    if (this.context?.origin === 'public' && hit.scope === 'private') score -= 20;

    return score;
  }

  private rankSuggestions(suggestions: SuggestionItem[], query: string): SuggestionItem[] {
    return suggestions
      .sort((a, b) => {
        // Priorité aux correspondances exactes au début
        const aStartsWith = a.label.toLowerCase().startsWith(query.toLowerCase());
        const bStartsWith = b.label.toLowerCase().startsWith(query.toLowerCase());
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        // Puis par score de pertinence
        return (b.relevanceScore || 0) - (a.relevanceScore || 0);
      });
  }

  private cacheByPrefix(prefix: string, suggestions: SuggestionItem[], originalQuery: string) {
    // Éviter les caches trop petits ou trop volumineux
    if (prefix.length < this.minPrefixLength || suggestions.length === 0) return;

    const entry: PrefixCacheEntry = {
      prefix,
      suggestions,
      timestamp: Date.now(),
      totalCount: suggestions.length,
      isComplete: suggestions.length < this.maxSuggestions * 2 // Heuristique de complétude
    };

    this.prefixCache.set(prefix, entry);
    this.evictOldCacheEntries();
  }

  private getRecentSearchSuggestions(): SuggestionItem[] {
    const recentSearches = this.context?.recentSearches || [];
    
    return recentSearches.slice(0, 5).map(search => ({
      label: search,
      isPrivate: false,
      category: 'Recherches récentes'
    }));
  }

  private evictOldCacheEntries() {
    if (this.prefixCache.size <= this.maxCacheSize) return;

    // Stratégie LRU avec pondération par utilité
    const entries = Array.from(this.prefixCache.entries());
    const sorted = entries.sort(([, a], [, b]) => {
      const ageA = Date.now() - a.timestamp;
      const ageB = Date.now() - b.timestamp;
      const utilityA = a.totalCount / (ageA / 1000); // suggestions par seconde
      const utilityB = b.totalCount / (ageB / 1000);
      
      return utilityA - utilityB; // Moins utiles en premier
    });

    // Supprimer 20% des entrées les moins utiles
    const toRemove = Math.floor(this.prefixCache.size * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.prefixCache.delete(sorted[i][0]);
    }
  }

  private startCacheCleanup() {
    // Nettoyage périodique du cache
    setInterval(() => {
      const now = Date.now();
      for (const [prefix, entry] of this.prefixCache.entries()) {
        if (now - entry.timestamp > this.prefixCacheTTL) {
          this.prefixCache.delete(prefix);
        }
      }
    }, 5 * 60 * 1000); // Toutes les 5 minutes
  }

  // Méthodes de monitoring
  getCacheStats() {
    const now = Date.now();
    const validEntries = Array.from(this.prefixCache.values()).filter(
      entry => now - entry.timestamp <= this.prefixCacheTTL
    );

    return {
      totalEntries: this.prefixCache.size,
      validEntries: validEntries.length,
      averageAge: validEntries.length > 0 
        ? validEntries.reduce((sum, entry) => sum + (now - entry.timestamp), 0) / validEntries.length
        : 0,
      totalSuggestionsCached: validEntries.reduce((sum, entry) => sum + entry.totalCount, 0),
      averageSuggestionsPerPrefix: validEntries.length > 0
        ? validEntries.reduce((sum, entry) => sum + entry.totalCount, 0) / validEntries.length
        : 0
    };
  }

  // Préchargement intelligent
  async preloadPopularPrefixes(popularQueries: string[]) {
    const prefixes = new Set<string>();
    
    // Extraire les préfixes populaires
    for (const query of popularQueries) {
      if (query.length >= this.minPrefixLength) {
        for (let i = this.minPrefixLength; i <= Math.min(query.length, 4); i++) {
          prefixes.add(query.substring(0, i));
        }
      }
    }

    // Précharger en arrière-plan
    for (const prefix of prefixes) {
      if (!this.prefixCache.has(prefix)) {
        try {
          await this.fetchAndCacheSuggestions(prefix, this.maxSuggestions * 2);
          // Petit délai pour éviter de surcharger
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.warn(`Failed to preload prefix ${prefix}:`, error);
        }
      }
    }
  }

  clear() {
    this.prefixCache.clear();
    this.recentSearchCache.clear();
    if (this.client) {
      this.client.dispose();
      this.client = null;
    }
    this.context = null;
  }
}

// Instance globale
export const smartSuggestionManager = new SmartSuggestionManager();
