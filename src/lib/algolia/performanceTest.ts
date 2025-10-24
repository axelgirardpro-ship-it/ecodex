// Outils de test de performance Algolia (usage interne)
import { createUnifiedClient } from './unifiedSearchClient';

export class PerformanceTester {
  private client: unknown;
  constructor() {
    this.client = createUnifiedClient();
  }

  async smokeTest(testQueries: string[]): Promise<void> {
    for (const query of testQueries) {
      try {
        const result = await this.client.search([{
          params: { query, hitsPerPage: 10 }
        }]);
        console.log('[perf] smoke', query, result?.results?.[0]?.nbHits);
      } catch (error) {
        console.warn('[perf] smoke error', query, error);
      }
    }
  }

  async cacheHitRate(query: string, iterations = 5): Promise<void> {
    let successCount = 0;
    try {
      await this.client.search([{ params: { query, hitsPerPage: 10 } }]);
      successCount++;
    } catch (error) {
      console.warn('[perf] first call error', error);
    }

    for (let i = 0; i < iterations - 1; i++) {
      try {
        await this.client.search([{ params: { query, hitsPerPage: 10 } }]);
        successCount++;
      } catch (error) {
        console.warn('[perf] repeat error', error);
      }
    }
    console.log('[perf] cacheHitRate', { query, iterations, successCount });
  }
}
