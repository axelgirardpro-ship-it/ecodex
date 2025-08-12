import React from 'react';
import { useStats } from 'react-instantsearch';

export const SearchStats: React.FC = () => {
  const { nbHits, nbSortedHits, areHitsSorted, processingTimeMS } = useStats();

  return (
    <div className="flex items-center justify-between text-sm text-indigo-950 mb-4 font-montserrat">
      <div>
        {areHitsSorted && nbSortedHits !== nbHits ? (
          <span>
            {nbSortedHits?.toLocaleString()} résultats pertinents sur {nbHits?.toLocaleString()}
          </span>
        ) : (
          <span className="font-semibold">{nbHits?.toLocaleString()} résultat{nbHits > 1 ? 's' : ''} trouvé{nbHits > 1 ? 's' : ''}</span>
        )}
      </div>
      <div>
        en {processingTimeMS} ms
      </div>
    </div>
  );
};