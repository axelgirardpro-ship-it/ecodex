import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import { ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BenchmarkItemModal } from './BenchmarkItemModal';
import { formatEmissionFactor } from '@/lib/formatters/benchmarkFormatters';
import type { BenchmarkChartDataPoint, BenchmarkStatistics, DisplayMode, SortOrder } from '@/types/benchmark';

interface BenchmarkChartProps {
  data: BenchmarkChartDataPoint[];
  statistics: BenchmarkStatistics;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (order: SortOrder) => void;
  totalCount: number;
  unit: string;
  allData?: BenchmarkChartDataPoint[]; // Toutes les données pour retrouver les items au clic
}

export const BenchmarkChart = ({
  data,
  statistics,
  displayMode,
  onDisplayModeChange,
  sortOrder,
  onSortOrderChange,
  totalCount,
  unit,
  allData,
}: BenchmarkChartProps) => {
  const { t } = useTranslation('benchmark');
  const [selectedItem, setSelectedItem] = useState<BenchmarkChartDataPoint | null>(null);

  // Utiliser allData pour retrouver les items complets, sinon data
  const fullDataSource = allData || data;

  // Fonction pour tronquer le nom si trop long
  const truncateName = (name: string, maxLength: number = 30): string => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
  };

  // Fonction pour obtenir la couleur en fonction de Q1/Q3
  const getBarColor = (value: number): string => {
    const { q1, q3 } = statistics;

    if (value < q1) {
      // Vert si en dessous de Q1
      return 'hsl(142, 70%, 45%)';
    } else if (value <= q3) {
      // Jaune entre Q1 et Q3
      return 'hsl(48, 100%, 62%)';
    } else {
      // Marron au-dessus de Q3
      return 'hsl(25, 50%, 40%)';
    }
  };

  const handleToggleSortOrder = () => {
    onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: BenchmarkChartDataPoint }> }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as BenchmarkChartDataPoint;
      // Retrouver l'item original pour afficher le nom complet
      const originalItem = fullDataSource.find(d => d.objectID === item.objectID) || item;
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm max-w-sm">
          <p className="font-semibold text-foreground mb-1">{originalItem.name}</p>
          <p className="text-muted-foreground">
            <span className="font-medium">{t('chart.tooltip.value', 'Value')}:</span> {formatEmissionFactor(originalItem.fe)} {originalItem.unit}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium">{t('chart.tooltip.source', 'Source')}:</span> {originalItem.source}
          </p>
          {originalItem.date && (
            <p className="text-muted-foreground">
              <span className="font-medium">{t('chart.tooltip.year', 'Year')}:</span> {originalItem.date}
            </p>
          )}
          <p className="text-muted-foreground">
            <span className="font-medium">{t('chart.tooltip.scope', 'Scope')}:</span> {originalItem.scope}
          </p>
          {originalItem.localisation && (
            <p className="text-muted-foreground">
              <span className="font-medium">{t('chart.tooltip.location', 'Location')}:</span> {originalItem.localisation}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2 italic">
            {t('chart.tooltip.click_details', 'Click to see full details')}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>{t('chart.title', 'Distribution chart')}</CardTitle>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Selector d'affichage (seulement si plus de 25 résultats) */}
              {totalCount > 25 && (
                <div className="flex items-center border rounded-md bg-background">
                  <Button
                    variant={displayMode === 25 ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onDisplayModeChange(25)}
                    className="rounded-r-none"
                  >
                    25
                  </Button>
                  <Button
                    variant={displayMode === 50 ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onDisplayModeChange(50)}
                    className="rounded-l-none"
                    disabled={totalCount < 50}
                  >
                    50
                  </Button>
                </div>
              )}

              {/* Toggle ordre */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleSortOrder}
                title={sortOrder === 'asc' ? 'Ordre croissant' : 'Ordre décroissant'}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Badge info affichage et unité */}
          <div className="flex items-center gap-2 mt-4">
            <Badge variant="secondary">
              {totalCount <= 25
                ? t('header.display.all_displayed', {
                    defaultValue: '{{count}} FE affichés',
                    count: totalCount
                  })
                : t('header.display.selected_points', {
                    defaultValue: 'Affichage : {{selected}} points sélectionnés sur {{total}} FE',
                    selected: Math.min(displayMode, totalCount),
                    total: totalCount
                  })
              }
            </Badge>
            <Badge variant="outline">
              kgCO2eq/{unit}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Légende fixe */}
          <div className="flex items-center justify-center gap-6 mb-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-12 h-0.5 border-t-2 border-dashed border-blue-400"></div>
              <span className="text-sm font-medium text-muted-foreground">
                {t('chart.legend.q1', 'Q1')}: <span className="text-foreground">{formatEmissionFactor(statistics.q1)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-12 h-1 bg-blue-600 rounded"></div>
              <span className="text-sm font-medium text-muted-foreground">
                {t('chart.legend.median', 'Median')}: <span className="text-foreground font-semibold">{formatEmissionFactor(statistics.median)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-12 h-0.5 border-t-2 border-dashed border-purple-500"></div>
              <span className="text-sm font-medium text-muted-foreground">
                {t('chart.legend.q3', 'Q3')}: <span className="text-foreground">{formatEmissionFactor(statistics.q3)}</span>
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={500}>
            <BarChart
              data={data.map(d => ({ ...d, name: truncateName(d.name) }))}
              margin={{ top: 20, right: 30, left: 30, bottom: 120 }}
            >
              <defs>
                <linearGradient id="colorFE" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ABEA1" />
                  <stop offset="50%" stopColor="#FFD93D" />
                  <stop offset="100%" stopColor="#FF6B6B" />
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />
              
              <YAxis
                label={{
                  value: `kgCO2eq/${unit}`,
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: 'hsl(var(--foreground))' },
                }}
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
              
              {/* Lignes de référence pour Q1, Médiane, Q3 (sans labels) */}
              <ReferenceLine
                y={statistics.q1}
                stroke="#60a5fa"
                strokeDasharray="5 5"
                strokeWidth={2}
              />
              <ReferenceLine
                y={statistics.median}
                stroke="#2563eb"
                strokeWidth={3}
              />
              <ReferenceLine
                y={statistics.q3}
                stroke="#a855f7"
                strokeDasharray="5 5"
                strokeWidth={2}
              />
              
              <Bar
                dataKey="fe"
                radius={[4, 4, 0, 0]}
                onClick={(dataPoint) => {
                  // Retrouver l'item original (pas tronqué) pour le modal
                  const originalItem = fullDataSource.find(d => d.objectID === dataPoint.objectID);
                  if (originalItem) setSelectedItem(originalItem);
                }}
                cursor="pointer"
                activeBar={{ fill: '#a855f7' }}
                minPointSize={15}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.fe)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {totalCount > 1000 && (
            <p className="text-sm text-amber-600 mt-4 text-center">
              ⚠️ {t('chart.warning.limit_1000', 'More than 1000 results, only the first 1000 are analyzed')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Modal détails FE */}
      <BenchmarkItemModal
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </>
  );
};

