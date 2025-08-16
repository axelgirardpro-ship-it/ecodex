// Tests de performance pour le système Algolia optimisé
import { createUnifiedClient } from './unifiedSearchClient';
import { performanceMonitor } from './performanceMonitor';
import { smartSuggestionManager } from './smartSuggestions';
import { algoliaCache } from './cacheManager';

export interface PerformanceTestResult {
  testName: string;
  duration: number;
  requestsCount: number;
  successRate: number;
  cacheHitRate: number;
  averageResponseTime: number;
  errors: string[];
  recommendations: string[];
}

export class AlgoliaPerformanceTester {
  private client: any;
  private testResults: PerformanceTestResult[] = [];

  constructor(workspaceId?: string, assignedSources: string[] = []) {
    this.client = createUnifiedClient(workspaceId, assignedSources);
  }

  async runAllTests(): Promise<PerformanceTestResult[]> {
    console.log('🚀 Démarrage des tests de performance Algolia...');
    
    // Reset des métriques
    performanceMonitor.reset();
    algoliaCache.clear();
    
    const tests = [
      () => this.testBasicSearch(),
      () => this.testCacheEfficiency(),
      () => this.testDeduplication(),
      () => this.testSuggestions(),
      () => this.testBatching(),
      () => this.testErrorHandling(),
      () => this.testConcurrentRequests(),
      () => this.testLargeQueries()
    ];

    for (const test of tests) {
      try {
        const result = await test();
        this.testResults.push(result);
        console.log(`✅ ${result.testName}: ${result.duration}ms (${result.requestsCount} requêtes)`);
      } catch (error) {
        console.error(`❌ Erreur dans le test:`, error);
        this.testResults.push({
          testName: 'Test échoué',
          duration: 0,
          requestsCount: 0,
          successRate: 0,
          cacheHitRate: 0,
          averageResponseTime: 0,
          errors: [String(error)],
          recommendations: ['Vérifier la configuration du test']
        });
      }
    }

    return this.generateReport();
  }

  private async testBasicSearch(): Promise<PerformanceTestResult> {
    const startTime = Date.now();
    const testQueries = ['électricité', 'transport', 'chauffage', 'eau', 'déchets'];
    let successCount = 0;
    const errors: string[] = [];

    for (const query of testQueries) {
      try {
        const result = await this.client.search([{
          params: { query, hitsPerPage: 10 }
        }]);
        
        if (result.results && result.results[0]) {
          successCount++;
        }
      } catch (error) {
        errors.push(`Erreur recherche "${query}": ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    const metrics = performanceMonitor.getMetrics();

    return {
      testName: 'Recherches de base',
      duration,
      requestsCount: testQueries.length,
      successRate: (successCount / testQueries.length) * 100,
      cacheHitRate: metrics.cacheHitRate,
      averageResponseTime: metrics.averageResponseTime,
      errors,
      recommendations: this.generateBasicRecommendations(metrics)
    };
  }

  private async testCacheEfficiency(): Promise<PerformanceTestResult> {
    const startTime = Date.now();
    const query = 'électricité france';
    const iterations = 5;
    let successCount = 0;
    const errors: string[] = [];

    // Premier appel pour remplir le cache
    try {
      await this.client.search([{ params: { query, hitsPerPage: 10 } }]);
      successCount++;
    } catch (error) {
      errors.push(`Erreur première requête: ${error}`);
    }

    // Appels suivants pour tester le cache
    for (let i = 0; i < iterations - 1; i++) {
      try {
        await this.client.search([{ params: { query, hitsPerPage: 10 } }]);
        successCount++;
      } catch (error) {
        errors.push(`Erreur requête cache ${i + 2}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    const cacheStats = algoliaCache.getCacheStats();
    
    return {
      testName: 'Efficacité du cache',
      duration,
      requestsCount: iterations,
      successRate: (successCount / iterations) * 100,
      cacheHitRate: cacheStats.metrics.cacheHitRate,
      averageResponseTime: duration / iterations,
      errors,
      recommendations: this.generateCacheRecommendations(cacheStats)
    };
  }

  private async testDeduplication(): Promise<PerformanceTestResult> {
    const startTime = Date.now();
    const query = 'transport routier';
    const simultaneousRequests = 5;
    let successCount = 0;
    const errors: string[] = [];

    // Lancer plusieurs requêtes identiques simultanément
    const promises = Array(simultaneousRequests).fill(null).map(async (_, index) => {
      try {
        await this.client.search([{ params: { query, hitsPerPage: 10 } }]);
        successCount++;
      } catch (error) {
        errors.push(`Erreur déduplication ${index + 1}: ${error}`);
      }
    });

    await Promise.all(promises);
    const duration = Date.now() - startTime;
    const metrics = performanceMonitor.getMetrics();

    return {
      testName: 'Déduplication des requêtes',
      duration,
      requestsCount: simultaneousRequests,
      successRate: (successCount / simultaneousRequests) * 100,
      cacheHitRate: metrics.cacheHitRate,
      averageResponseTime: duration / simultaneousRequests,
      errors,
      recommendations: this.generateDeduplicationRecommendations(metrics)
    };
  }

  private async testSuggestions(): Promise<PerformanceTestResult> {
    const startTime = Date.now();
    const prefixes = ['él', 'tra', 'cha', 'ea', 'dé'];
    let successCount = 0;
    const errors: string[] = [];

    // Configurer le context pour les suggestions
    smartSuggestionManager.updateContext({
      origin: 'all',
      assignedSources: [],
      recentSearches: ['électricité', 'transport']
    });

    for (const prefix of prefixes) {
      try {
        const suggestions = await smartSuggestionManager.getSuggestions(prefix, 5);
        if (suggestions.length > 0) {
          successCount++;
        }
      } catch (error) {
        errors.push(`Erreur suggestion "${prefix}": ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    const cacheStats = smartSuggestionManager.getCacheStats();

    return {
      testName: 'Suggestions intelligentes',
      duration,
      requestsCount: prefixes.length,
      successRate: (successCount / prefixes.length) * 100,
      cacheHitRate: (cacheStats.validEntries / Math.max(cacheStats.totalEntries, 1)) * 100,
      averageResponseTime: duration / prefixes.length,
      errors,
      recommendations: this.generateSuggestionsRecommendations(cacheStats)
    };
  }

  private async testBatching(): Promise<PerformanceTestResult> {
    const startTime = Date.now();
    const queries = ['électricité', 'gaz', 'fioul', 'bois'];
    let successCount = 0;
    const errors: string[] = [];

    // Créer plusieurs requêtes qui devraient être batchées
    const promises = queries.map(async (query, index) => {
      try {
        // Petit délai pour permettre le batching
        await new Promise(resolve => setTimeout(resolve, index * 10));
        
        const result = await this.client.search([{
          params: { query, hitsPerPage: 5 }
        }], { enableBatching: true });
        
        if (result.results) {
          successCount++;
        }
      } catch (error) {
        errors.push(`Erreur batch "${query}": ${error}`);
      }
    });

    await Promise.all(promises);
    const duration = Date.now() - startTime;
    const metrics = performanceMonitor.getMetrics();

    return {
      testName: 'Batching des requêtes',
      duration,
      requestsCount: queries.length,
      successRate: (successCount / queries.length) * 100,
      cacheHitRate: metrics.cacheHitRate,
      averageResponseTime: duration / queries.length,
      errors,
      recommendations: this.generateBatchingRecommendations(metrics)
    };
  }

  private async testErrorHandling(): Promise<PerformanceTestResult> {
    const startTime = Date.now();
    const invalidQueries = ['', '   ', 'query_with_invalid_chars_@#$%'];
    let successCount = 0;
    const errors: string[] = [];

    for (const query of invalidQueries) {
      try {
        const result = await this.client.search([{
          params: { query, hitsPerPage: 10 }
        }]);
        
        // Même les requêtes invalides devraient retourner une structure valide
        if (result.results !== undefined) {
          successCount++;
        }
      } catch (error) {
        errors.push(`Erreur gestion "${query}": ${error}`);
      }
    }

    const duration = Date.now() - startTime;

    return {
      testName: 'Gestion des erreurs',
      duration,
      requestsCount: invalidQueries.length,
      successRate: (successCount / invalidQueries.length) * 100,
      cacheHitRate: 0, // Pas applicable pour ce test
      averageResponseTime: duration / invalidQueries.length,
      errors,
      recommendations: errors.length > 0 ? ['Améliorer la gestion des cas limites'] : ['Gestion d\'erreurs robuste']
    };
  }

  private async testConcurrentRequests(): Promise<PerformanceTestResult> {
    const startTime = Date.now();
    const concurrency = 10;
    const query = 'énergie renouvelable';
    let successCount = 0;
    const errors: string[] = [];

    const promises = Array(concurrency).fill(null).map(async (_, index) => {
      try {
        await this.client.search([{
          params: { query: `${query} ${index}`, hitsPerPage: 10 }
        }]);
        successCount++;
      } catch (error) {
        errors.push(`Erreur concurrent ${index}: ${error}`);
      }
    });

    await Promise.all(promises);
    const duration = Date.now() - startTime;
    const metrics = performanceMonitor.getMetrics();

    return {
      testName: 'Requêtes concurrentes',
      duration,
      requestsCount: concurrency,
      successRate: (successCount / concurrency) * 100,
      cacheHitRate: metrics.cacheHitRate,
      averageResponseTime: duration / concurrency,
      errors,
      recommendations: this.generateConcurrencyRecommendations(metrics, concurrency)
    };
  }

  private async testLargeQueries(): Promise<PerformanceTestResult> {
    const startTime = Date.now();
    const largeQueries = [
      'électricité consommation domestique facteur émission carbone france 2024',
      'transport routier véhicule léger essence diesel hybride électrique comparaison',
      'chauffage gaz naturel fioul domestique pompe chaleur efficacité énergétique'
    ];
    let successCount = 0;
    const errors: string[] = [];

    for (const query of largeQueries) {
      try {
        const result = await this.client.search([{
          params: { query, hitsPerPage: 20 }
        }]);
        
        if (result.results && result.results[0]) {
          successCount++;
        }
      } catch (error) {
        errors.push(`Erreur requête longue: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    const metrics = performanceMonitor.getMetrics();

    return {
      testName: 'Requêtes complexes',
      duration,
      requestsCount: largeQueries.length,
      successRate: (successCount / largeQueries.length) * 100,
      cacheHitRate: metrics.cacheHitRate,
      averageResponseTime: duration / largeQueries.length,
      errors,
      recommendations: this.generateComplexQueryRecommendations(metrics)
    };
  }

  private generateBasicRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];
    
    if (metrics.averageResponseTime > 1000) {
      recommendations.push('Temps de réponse élevé, considérer l\'augmentation du cache TTL');
    }
    if (metrics.cacheHitRate < 50) {
      recommendations.push('Taux de cache faible, vérifier la configuration du cache');
    }
    if (recommendations.length === 0) {
      recommendations.push('Performance de base satisfaisante');
    }

    return recommendations;
  }

  private generateCacheRecommendations(cacheStats: any): string[] {
    const recommendations: string[] = [];
    
    if (cacheStats.metrics.cacheHitRate < 80) {
      recommendations.push('Augmenter le TTL du cache pour améliorer le hit rate');
    }
    if (cacheStats.size > cacheStats.maxSize * 0.9) {
      recommendations.push('Considérer l\'augmentation de la taille du cache');
    }
    if (recommendations.length === 0) {
      recommendations.push('Cache très efficace');
    }

    return recommendations;
  }

  private generateDeduplicationRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];
    
    if (metrics.deduplicationRate < 70) {
      recommendations.push('Améliorer les clés de déduplication');
    }
    if (metrics.duplicateRequestsAvoided > 0) {
      recommendations.push(`${metrics.duplicateRequestsAvoided} requêtes dupliquées évitées`);
    }

    return recommendations;
  }

  private generateSuggestionsRecommendations(cacheStats: any): string[] {
    const recommendations: string[] = [];
    
    if (cacheStats.averageSuggestionsPerPrefix < 3) {
      recommendations.push('Augmenter le nombre de suggestions par préfixe');
    }
    if (cacheStats.validEntries < 10) {
      recommendations.push('Précharger plus de préfixes populaires');
    }

    return recommendations;
  }

  private generateBatchingRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];
    
    if (metrics.averageResponseTime > 500) {
      recommendations.push('Optimiser la taille des batches');
    }
    
    return recommendations.length > 0 ? recommendations : ['Batching efficace'];
  }

  private generateConcurrencyRecommendations(metrics: any, concurrency: number): string[] {
    const recommendations: string[] = [];
    
    if (metrics.averageResponseTime > 200 * concurrency) {
      recommendations.push('Gestion de concurrence sous-optimale');
    }
    
    return recommendations.length > 0 ? recommendations : ['Bonne gestion de la concurrence'];
  }

  private generateComplexQueryRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];
    
    if (metrics.averageResponseTime > 800) {
      recommendations.push('Optimiser les requêtes complexes');
    }
    
    return recommendations.length > 0 ? recommendations : ['Bonnes performances sur requêtes complexes'];
  }

  private generateReport(): PerformanceTestResult[] {
    const overallMetrics = performanceMonitor.getMetrics();
    
    console.log('\n🎯 RAPPORT DE PERFORMANCE ALGOLIA');
    console.log('================================');
    console.log(`📊 Métriques globales:`);
    console.log(`   • Requêtes totales: ${overallMetrics.totalRequests}`);
    console.log(`   • Taux de succès: ${(overallMetrics.successfulRequests / overallMetrics.totalRequests * 100).toFixed(1)}%`);
    console.log(`   • Cache hit rate: ${overallMetrics.cacheHitRate.toFixed(1)}%`);
    console.log(`   • Temps moyen: ${overallMetrics.averageResponseTime.toFixed(0)}ms`);
    console.log(`   • Économies: ${overallMetrics.totalRequestsSaved} requêtes évitées`);
    
    console.log('\n📋 Résultats par test:');
    this.testResults.forEach(result => {
      console.log(`   • ${result.testName}: ${result.successRate.toFixed(1)}% succès en ${result.duration}ms`);
    });

    const failedTests = this.testResults.filter(r => r.successRate < 90);
    if (failedTests.length > 0) {
      console.log('\n⚠️  Tests nécessitant attention:');
      failedTests.forEach(test => {
        console.log(`   • ${test.testName}: ${test.errors.join(', ')}`);
      });
    }

    console.log('\n✅ Tests de performance terminés!');
    
    return this.testResults;
  }

  dispose() {
    if (this.client) {
      this.client.dispose();
    }
  }
}

// Export pour utilisation dans les tests
export const runPerformanceTests = async (workspaceId?: string, assignedSources: string[] = []) => {
  const tester = new AlgoliaPerformanceTester(workspaceId, assignedSources);
  try {
    return await tester.runAllTests();
  } finally {
    tester.dispose();
  }
};

export default AlgoliaPerformanceTester;
