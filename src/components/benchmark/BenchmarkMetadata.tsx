import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BenchmarkMetadata as BenchmarkMetadataType } from '@/types/benchmark';

interface BenchmarkMetadataProps {
  metadata: BenchmarkMetadataType;
}

export const BenchmarkMetadata = ({ metadata }: BenchmarkMetadataProps) => {
  const { t } = useTranslation('benchmark');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('metadata.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Requête
            </p>
            <p className="text-lg font-semibold text-foreground">{metadata.query}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {t('metadata.unit')}
            </p>
            <p className="text-lg font-semibold text-foreground">{metadata.unit}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {t('metadata.scope')}
            </p>
            <p className="text-lg font-semibold text-foreground">{metadata.scope}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {t('metadata.sample_size')}
            </p>
            <p className="text-lg font-semibold text-foreground">
              {metadata.sourcesCount} {t('metadata.sources', { count: metadata.sourcesCount })}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {t('metadata.period')}
            </p>
            <p className="text-lg font-semibold text-foreground">
              {metadata.dateRange && metadata.dateRange.min && metadata.dateRange.max
                ? `${metadata.dateRange.min} - ${metadata.dateRange.max}`
                : '-'}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-muted-foreground mb-3">
            {t('metadata.sources', { count: metadata.sources.length })}
          </p>
          <div className="flex flex-wrap gap-2">
            {metadata.sources.map((source) => (
              <Badge key={source} variant="secondary">
                {source}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

