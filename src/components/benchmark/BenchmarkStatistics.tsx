import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatEmissionFactor } from '@/lib/formatters/benchmarkFormatters';
import type { BenchmarkStatistics as BenchmarkStatisticsType } from '@/types/benchmark';

interface BenchmarkStatisticsProps {
  statistics: BenchmarkStatisticsType;
  unit: string;
}

export const BenchmarkStatistics = ({ statistics, unit }: BenchmarkStatisticsProps) => {
  const { t } = useTranslation('benchmark');

  const stats = [
    {
      key: 'median',
      value: statistics.median,
      isPrimary: true,
      unitLabel: 'kgCO2eq',
    },
    {
      key: 'q1',
      value: statistics.q1,
      unitLabel: 'kgCO2eq',
    },
    {
      key: 'q3',
      value: statistics.q3,
      unitLabel: 'kgCO2eq',
    },
    {
      key: 'min',
      value: statistics.min,
      unitLabel: 'kgCO2eq',
    },
    {
      key: 'max',
      value: statistics.max,
      unitLabel: 'kgCO2eq',
    },
    {
      key: 'mean',
      value: statistics.mean,
      unitLabel: 'kgCO2eq',
    },
    {
      key: 'stdDev',
      value: statistics.standardDeviation,
      unitLabel: 'kgCO2eq',
    },
    {
      key: 'iqr',
      value: statistics.iqr,
      unitLabel: 'kgCO2eq',
    },
    {
      key: 'percentRange',
      value: statistics.percentRange,
      isPercent: true,
      unitLabel: '%',
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
                  <TooltipProvider delayDuration={100}>
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
                  {stat.isPercent ? stat.value.toFixed(1) : formatEmissionFactor(stat.value)}
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    {stat.unitLabel}
                  </span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

