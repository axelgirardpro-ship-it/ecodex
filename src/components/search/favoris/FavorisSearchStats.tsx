import React from 'react';
import { useStats } from 'react-instantsearch';

export const FavorisSearchStats: React.FC = () => {
  const { nbHits, nbSortedHits, areHitsSorted, processingTimeMS } = useStats();

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
      <div>
        {areHitsSorted && nbSortedHits !== nbHits ? (
          <span>
            {nbSortedHits?.toLocaleString()} résultats pertinents sur {nbHits?.toLocaleString()} favoris
          </span>
        ) : (
          <span className="font-semibold text-foreground">
            {nbHits?.toLocaleString()} favori{nbHits > 1 ? 's' : ''} trouvé{nbHits > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div>
        en {processingTimeMS} ms
      </div>
    </div>
  );
};