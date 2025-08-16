import React from 'react';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const DebugSearchState: React.FC = () => {
  const { recentSearches } = useSearchHistory();

  if (!import.meta.env.DEV) {
    return null; // Ne s'affiche qu'en développement
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm">🔍 Debug - État de la recherche</CardTitle>
      </CardHeader>
      <CardContent className="text-xs">
        <div className="space-y-2">
          <div>
            <strong>Recherches récentes:</strong> {' '}
            {recentSearches ? (
              recentSearches.length > 0 ? (
                <span className="text-green-600">{recentSearches.join(', ')}</span>
              ) : (
                <span className="text-gray-500">Aucune</span>
              )
            ) : (
              <span className="text-orange-500">Non chargées</span>
            )}
          </div>
          <div>
            <strong>Type:</strong> {Array.isArray(recentSearches) ? 'Array' : typeof recentSearches}
          </div>
          <div>
            <strong>Longueur:</strong> {recentSearches?.length ?? 'undefined'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DebugSearchState;
