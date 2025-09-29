import React from 'react';
import { useStats } from 'react-instantsearch';
import { useTranslation } from 'react-i18next';
import { useSafeLanguage } from '@/hooks/useSafeLanguage';

export const FavorisSearchStats: React.FC = () => {
  const { nbHits, nbSortedHits, areHitsSorted, processingTimeMS } = useStats();
  const language = useSafeLanguage();
  const { t: tSearch } = useTranslation('search');
  const { t: tStats } = useTranslation('search', { keyPrefix: 'stats' });
  const { t: tFavoris } = useTranslation('search', { keyPrefix: 'favoris.stats' });

  const formatNumber = (num: number) => num?.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US') ?? '0';

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
      <div>
        {areHitsSorted && nbSortedHits !== nbHits ? (
          <span>
            {tFavoris('relevantFavorites', {
              sorted: formatNumber(nbSortedHits ?? 0),
              total: formatNumber(nbHits ?? 0),
            })}
          </span>
        ) : (
          <span className="font-semibold text-foreground">
            {nbHits === 0
              ? tFavoris('noFavorites')
              : nbHits === 1
                ? tFavoris('oneFavoriteFound', { formattedCount: formatNumber(nbHits) })
                : tFavoris('multipleFavoritesFound', { formattedCount: formatNumber(nbHits), count: nbHits })}
          </span>
        )}
      </div>
      <div>
        {tStats('timeMs', { time: processingTimeMS })}
      </div>
    </div>
  );
};