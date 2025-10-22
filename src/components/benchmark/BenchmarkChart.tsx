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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BenchmarkItemModal } from './BenchmarkItemModal';
import type { BenchmarkChartDataPoint, BenchmarkStatistics, DisplayMode } from '@/types/benchmark';

interface BenchmarkChartProps {
  data: BenchmarkChartDataPoint[];
  statistics: BenchmarkStatistics;
  displayMode: DisplayMode;
  totalCount: number;
  allData?: BenchmarkChartDataPoint[]; // Toutes les données pour retrouver les items au clic
}

export const BenchmarkChart = ({
  data,
  statistics,
  displayMode,
  totalCount,
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

  // Fonction pour obtenir la couleur en fonction de la valeur (gradient vert → jaune → rouge)
  const getBarColor = (value: number): string => {
    const { min, max } = statistics;
    const range = max - min;
    const normalized = (value - min) / range; // 0 à 1

    if (normalized < 0.33) {
      // Vert
      return 'hsl(166, 50%, 59%)'; // #4ABEA1
    } else if (normalized < 0.67) {
      // Jaune
      return 'hsl(48, 100%, 62%)'; // #FFD93D
    } else {
      // Rouge
      return 'hsl(0, 100%, 70%)'; // #FF6B6B
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as BenchmarkChartDataPoint;
      // Retrouver l'item original pour afficher le nom complet
      const originalItem = fullDataSource.find(d => d.objectID === item.objectID) || item;
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm max-w-sm">
          <p className="font-semibold text-foreground mb-1">{originalItem.name}</p>
          <p className="text-muted-foreground">
            <span className="font-medium">{t('chart.tooltip.value', 'Value')}:</span> {originalItem.fe.toFixed(4)} {originalItem.unit}
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
          <CardTitle>{t('chart.title', 'Distribution chart')}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Légende fixe */}
          <div className="flex items-center justify-center gap-6 mb-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-12 h-0.5 border-t-2 border-dashed border-blue-400"></div>
              <span className="text-sm font-medium text-muted-foreground">
                {t('chart.legend.q1', 'Q1')}: <span className="text-foreground">{statistics.q1.toFixed(2)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-12 h-1 bg-blue-600 rounded"></div>
              <span className="text-sm font-medium text-muted-foreground">
                {t('chart.legend.median', 'Median')}: <span className="text-foreground font-semibold">{statistics.median.toFixed(2)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-12 h-0.5 border-t-2 border-dashed border-purple-500"></div>
              <span className="text-sm font-medium text-muted-foreground">
                {t('chart.legend.q3', 'Q3')}: <span className="text-foreground">{statistics.q3.toFixed(2)}</span>
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={500}>
            <BarChart
              data={data.map(d => ({ ...d, name: truncateName(d.name) }))}
              margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
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
                  value: data[0]?.unit || '',
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

