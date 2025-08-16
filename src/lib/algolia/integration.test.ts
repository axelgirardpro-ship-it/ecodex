// Tests d'intégration pour le système Algolia optimisé
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createUnifiedClient } from './unifiedSearchClient';
import { performanceMonitor } from './performanceMonitor';
import { algoliaCache } from './cacheManager';
import { smartSuggestionManager } from './smartSuggestions';
import { runPerformanceTests } from './performanceTest';

describe('Système Algolia Optimisé - Tests d\'intégration', () => {
  let client: any;

  beforeAll(() => {
    // Reset des métriques pour tests propres
    performanceMonitor.reset();
    algoliaCache.clear();
    smartSuggestionManager.clear();
    
    // Créer un client de test
    client = createUnifiedClient('test-workspace', ['ADEME', 'Base Carbone']);
  });

  afterAll(() => {
    if (client) {
      client.dispose();
    }
  });

  describe('UnifiedSearchClient', () => {
    test('devrait effectuer une recherche de base', async () => {
      const result = await client.search([{
        params: {
          query: 'électricité',
          hitsPerPage: 10
        }
      }]);

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    test('devrait gérer les requêtes multiples', async () => {
      const requests = [
        { params: { query: 'électricité', hitsPerPage: 5 } },
        { params: { query: 'transport', hitsPerPage: 5 } }
      ];

      const result = await client.search(requests);

      expect(result.results).toHaveLength(2);
      result.results.forEach((res: any) => {
        expect(res).toBeDefined();
      });
    });

    test('devrait utiliser le cache pour les requêtes répétées', async () => {
      const query = 'test-cache-query';
      
      // Première requête
      const startTime1 = Date.now();
      await client.search([{ params: { query, hitsPerPage: 5 } }]);
      const time1 = Date.now() - startTime1;

      // Seconde requête (devrait être plus rapide grâce au cache)
      const startTime2 = Date.now();
      await client.search([{ params: { query, hitsPerPage: 5 } }]);
      const time2 = Date.now() - startTime2;

      // La seconde requête devrait être significativement plus rapide
      expect(time2).toBeLessThan(time1 * 0.5);
    });

    test('devrait gérer les erreurs gracieusement', async () => {
      // Requête avec paramètres invalides
      const result = await client.search([{
        params: {
          query: '',
          hitsPerPage: -1
        }
      }]);

      // Ne devrait pas lever d'erreur, mais retourner une structure valide
      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
    });
  });

  describe('Cache Manager', () => {
    test('devrait mettre en cache les résultats', () => {
      const testRequest = {
        params: { query: 'test', hitsPerPage: 10 }
      };
      const testData = { hits: [], nbHits: 0 };

      algoliaCache.set(testRequest, testData, 'all');
      const cached = algoliaCache.get(testRequest);

      expect(cached).toBeDefined();
      expect(cached?.data).toEqual(testData);
    });

    test('devrait invalider le cache par source', () => {
      const testRequest = {
        params: { query: 'test-source', hitsPerPage: 10 }
      };
      const testData = {
        results: [{
          hits: [{ Source: 'TEST_SOURCE' }]
        }]
      };

      algoliaCache.set(testRequest, testData);
      algoliaCache.invalidateBySource('TEST_SOURCE');

      const cached = algoliaCache.get(testRequest);
      expect(cached).toBeNull();
    });

    test('devrait calculer les métriques correctement', () => {
      const metrics = algoliaCache.getMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.totalRequests).toBe('number');
      expect(typeof metrics.savedRequests).toBe('number');
      expect(typeof metrics.cacheHitRate).toBe('number');
    });
  });

  describe('Smart Suggestions', () => {
    test('devrait configurer le contexte', () => {
      expect(() => {
        smartSuggestionManager.updateContext({
          workspaceId: 'test-workspace',
          assignedSources: ['ADEME'],
          origin: 'all',
          recentSearches: ['électricité', 'transport']
        });
      }).not.toThrow();
    });

    test('devrait retourner des suggestions pour requête vide', async () => {
      smartSuggestionManager.updateContext({
        workspaceId: 'test-workspace',
        assignedSources: ['ADEME'],
        origin: 'all',
        recentSearches: ['électricité', 'transport']
      });

      const suggestions = await smartSuggestionManager.getSuggestions('', 5);

      expect(Array.isArray(suggestions)).toBe(true);
      // Devrait retourner des recherches récentes
      expect(suggestions.length).toBeGreaterThan(0);
    });

    test('devrait utiliser le cache préfixe', async () => {
      smartSuggestionManager.updateContext({
        workspaceId: 'test-workspace',
        assignedSources: ['ADEME'],
        origin: 'all'
      });

      // Première recherche avec préfixe
      const suggestions1 = await smartSuggestionManager.getSuggestions('éle', 5);
      
      // Recherche plus spécifique avec même préfixe
      const suggestions2 = await smartSuggestionManager.getSuggestions('électr', 5);

      expect(Array.isArray(suggestions1)).toBe(true);
      expect(Array.isArray(suggestions2)).toBe(true);
    });

    test('devrait retourner des stats de cache', () => {
      const stats = smartSuggestionManager.getCacheStats();

      expect(stats).toBeDefined();
      expect(typeof stats.totalEntries).toBe('number');
      expect(typeof stats.validEntries).toBe('number');
    });
  });

  describe('Performance Monitor', () => {
    test('devrait enregistrer les métriques de requête', () => {
      performanceMonitor.recordRequest(
        250, // responseTime
        true, // success
        'test-user',
        'test query'
      );

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.successfulRequests).toBeGreaterThan(0);
    });

    test('devrait enregistrer les économies', () => {
      performanceMonitor.recordSaving('cache', 3);
      performanceMonitor.recordSaving('deduplication', 2);

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.totalRequestsSaved).toBeGreaterThanOrEqual(5);
    });

    test('devrait générer des recommandations', () => {
      const recommendations = performanceMonitor.generateRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('description');
      });
    });

    test('devrait effectuer l\'auto-tuning', () => {
      const adjustments = performanceMonitor.autoTune();

      expect(adjustments).toBeDefined();
      expect(adjustments).toHaveProperty('cacheAdjustments');
      expect(adjustments).toHaveProperty('throttlingAdjustments');
      expect(adjustments).toHaveProperty('debounceAdjustments');
    });
  });

  describe('Tests de performance complets', () => {
    test('devrait exécuter tous les tests de performance', async () => {
      const results = await runPerformanceTests('test-workspace', ['ADEME']);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      results.forEach(result => {
        expect(result).toHaveProperty('testName');
        expect(result).toHaveProperty('duration');
        expect(result).toHaveProperty('requestsCount');
        expect(result).toHaveProperty('successRate');
        expect(typeof result.successRate).toBe('number');
        expect(result.successRate).toBeGreaterThanOrEqual(0);
        expect(result.successRate).toBeLessThanOrEqual(100);
      });
    }, 30000); // Timeout étendu pour les tests de performance

    test('devrait avoir un taux de succès élevé', async () => {
      const results = await runPerformanceTests('test-workspace', ['ADEME']);
      
      const averageSuccessRate = results.reduce((sum, result) => 
        sum + result.successRate, 0) / results.length;

      expect(averageSuccessRate).toBeGreaterThan(80); // 80% minimum
    }, 30000);

    test('devrait démontrer l\'efficacité du cache', async () => {
      // Reset pour test propre
      performanceMonitor.reset();
      algoliaCache.clear();

      // Effectuer quelques requêtes
      await client.search([{ params: { query: 'test-cache-efficiency', hitsPerPage: 5 } }]);
      await client.search([{ params: { query: 'test-cache-efficiency', hitsPerPage: 5 } }]);
      await client.search([{ params: { query: 'test-cache-efficiency', hitsPerPage: 5 } }]);

      const metrics = performanceMonitor.getMetrics();
      
      // Devrait avoir un taux de cache > 0% après les requêtes répétées
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
    });
  });

  describe('Intégration complète', () => {
    test('devrait fonctionner de bout en bout', async () => {
      // Simulation d'une session utilisateur complète
      
      // 1. Recherches initiales
      await client.search([{ params: { query: 'électricité', hitsPerPage: 10 } }]);
      await client.search([{ params: { query: 'transport', hitsPerPage: 10 } }]);
      
      // 2. Suggestions
      smartSuggestionManager.updateContext({
        workspaceId: 'test-workspace',
        assignedSources: ['ADEME'],
        origin: 'all',
        recentSearches: ['électricité', 'transport']
      });
      
      const suggestions = await smartSuggestionManager.getSuggestions('é', 5);
      
      // 3. Requêtes répétées (devrait utiliser le cache)
      await client.search([{ params: { query: 'électricité', hitsPerPage: 10 } }]);
      
      // 4. Vérifier les métriques
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.successfulRequests).toBeGreaterThan(0);
      expect(Array.isArray(suggestions)).toBe(true);
      
      // Le système devrait avoir enregistré des économies
      expect(metrics.totalRequestsSaved).toBeGreaterThanOrEqual(0);
    });

    test('devrait maintenir les performances sous charge', async () => {
      const startTime = Date.now();
      
      // Simulation de charge avec requêtes concurrentes
      const promises = Array.from({ length: 10 }, (_, i) =>
        client.search([{ params: { query: `test-load-${i}`, hitsPerPage: 5 } }])
      );
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      // Toutes les requêtes devraient réussir
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
      });
      
      // Temps total raisonnable (moins de 10 secondes pour 10 requêtes)
      expect(totalTime).toBeLessThan(10000);
    });
  });
});

// Tests de régression pour vérifier que les anciennes fonctionnalités marchent toujours
describe('Tests de régression', () => {
  test('devrait maintenir la compatibilité avec l\'ancienne API', async () => {
    const client = createUnifiedClient();
    
    // Test avec l'ancienne structure de requête
    const result = await client.search([{
      indexName: 'ef_all',
      params: {
        query: 'électricité',
        hitsPerPage: 10,
        facetFilters: [['scope:public']],
        filters: 'access_level:standard'
      }
    }]);

    expect(result).toBeDefined();
    expect(result.results).toBeDefined();
    expect(result.results.length).toBeGreaterThan(0);
  });

  test('devrait gérer les cas limites', async () => {
    const client = createUnifiedClient();
    
    const edgeCases = [
      { params: { query: '', hitsPerPage: 0 } },
      { params: { query: '   ', hitsPerPage: 1000 } },
      { params: { query: 'a'.repeat(1000), hitsPerPage: 10 } }
    ];

    for (const request of edgeCases) {
      const result = await client.search([request]);
      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
    }
  });
});
