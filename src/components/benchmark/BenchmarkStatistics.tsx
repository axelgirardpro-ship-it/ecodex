import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { BenchmarkStatistics as BenchmarkStatisticsType } from '@/types/benchmark';

interface BenchmarkStatisticsProps {
  statistics: BenchmarkStatisticsType;
}

export const BenchmarkStatistics = ({ statistics }: BenchmarkStatisticsProps) => {
  const { t } = useTranslation('benchmark');

  const stats = [
    {
      key: 'median',
      value: statistics.median,
      isPrimary: true,
    },
    {
      key: 'q1',
      value: statistics.q1,
    },
    {
      key: 'q3',
      value: statistics.q3,
    },
    {
      key: 'min',
      value: statistics.min,
    },
    {
      key: 'max',
      value: statistics.max,
    },
    {
      key: 'mean',
      value: statistics.mean,
    },
    {
      key: 'stdDev',
      value: statistics.standardDeviation,
    },
    {
      key: 'iqr',
      value: statistics.iqr,
    },
    {
      key: 'percentRange',
      value: statistics.percentRange,
      isPercent: true,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('statistics.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card
              key={stat.key}
              className={stat.isPrimary ? 'border-primary shadow-md' : ''}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t(`statistics.${stat.key}.label`)}
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{t(`statistics.${stat.key}.tooltip`)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p
                  className={`text-3xl font-bold ${
                    stat.isPrimary ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {stat.value.toFixed(4)}
                  {stat.isPercent && '%'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

