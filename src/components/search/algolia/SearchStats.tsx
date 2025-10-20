import React from 'react';
import { useStats } from 'react-instantsearch';
import { useTranslation } from 'react-i18next';
import { useSafeLanguage } from '@/hooks/useSafeLanguage';

export const SearchStats: React.FC = () => {
  const { nbHits, nbSortedHits, areHitsSorted, processingTimeMS } = useStats();
  const language = useSafeLanguage();
  const { t } = useTranslation('search', { keyPrefix: 'stats' });

  const formatNumber = (num: number) => num?.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US') ?? '0';

  return (
    <div className="flex flex-col gap-1 text-sm text-indigo-950 mb-4 font-montserrat">
      <div>
        {areHitsSorted && nbSortedHits !== nbHits ? (
          <span>
            {t('relevantResults', { 
              sorted: formatNumber(nbSortedHits ?? 0), 
              total: formatNumber(nbHits ?? 0) 
            })}
          </span>
        ) : (
          <span className="font-semibold">
            {nbHits === 0 ? t('noResults') : 
             nbHits === 1 ? t('oneResultFound', { formattedCount: formatNumber(nbHits) }) :
             t('multipleResultsFound', { formattedCount: formatNumber(nbHits), count: nbHits })}
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground font-normal">
        {t('timeMs', { time: processingTimeMS })}
      </div>
    </div>
  );
};