import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, History, Save, FileDown, Share2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BenchmarkSaveModal } from './BenchmarkSaveModal';
import { BenchmarkHistoryDropdown } from './BenchmarkHistoryDropdown';
import { BenchmarkExportPDF } from './BenchmarkExportPDF';
import { BenchmarkExportPNG } from './BenchmarkExportPNG';
import { BenchmarkShare } from './BenchmarkShare';
import { useToast } from '@/hooks/use-toast';
import type { DisplayMode, SortOrder, BenchmarkData } from '@/types/benchmark';

interface BenchmarkHeaderProps {
  title: string;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (order: SortOrder) => void;
  benchmarkData: BenchmarkData;
  searchParams: {
    query: string;
    filters?: Record<string, any>;
    facetFilters?: string[][];
  };
  savedBenchmarkId?: string;
  benchmarkContainerId?: string;
}

export const BenchmarkHeader = ({
  title,
  displayMode,
  onDisplayModeChange,
  sortOrder,
  onSortOrderChange,
  benchmarkData,
  searchParams,
  savedBenchmarkId,
  benchmarkContainerId = 'benchmark-content',
}: BenchmarkHeaderProps) => {
  const { t } = useTranslation('benchmark');
  const { toast } = useToast();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);

  const handleToggleSortOrder = () => {
    onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate" title={title}>
            {title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('header.sample_size', {
              defaultValue: '{{count}} emission factors analyzed',
              count: benchmarkData.statistics.sampleSize
            })}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Selector d'affichage (seulement si plus de 25 résultats) */}
          {benchmarkData.chartData.length > 25 && (
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
                className="rounded-none border-x"
                disabled={benchmarkData.chartData.length < 50}
              >
                50
              </Button>
              <Button
                variant={displayMode === 100 ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onDisplayModeChange(100)}
                className="rounded-l-none"
                disabled={benchmarkData.chartData.length < 100}
              >
                100
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

          {/* Historique */}
          <DropdownMenu open={showHistoryDropdown} onOpenChange={setShowHistoryDropdown}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <History className="h-4 w-4 mr-2" />
                      {t('header.actions.history', 'History')}
                    </Button>
                  </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <BenchmarkHistoryDropdown onClose={() => setShowHistoryDropdown(false)} />
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sauvegarder (seulement si pas déjà sauvegardé) */}
          {!savedBenchmarkId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSaveModal(true)}
            >
              <Save className="h-4 w-4 mr-2" />
              {t('header.actions.save', 'Save')}
            </Button>
          )}

          {/* Export - Temporairement désactivé en raison de problèmes CSP */}
          {/* <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileDown className="h-4 w-4 mr-2" />
                Exporter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <BenchmarkExportPDF benchmarkData={benchmarkData} title={title} />
              <BenchmarkExportPNG benchmarkContainerId={benchmarkContainerId} filename={title} />
            </DropdownMenuContent>
          </DropdownMenu> */}

          {/* Partager */}
          <BenchmarkShare savedBenchmarkId={savedBenchmarkId} searchParams={searchParams} />
        </div>
      </div>

      {/* Badge info affichage */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary">
          {benchmarkData.chartData.length <= 25
            ? t('header.display.all_displayed', {
                defaultValue: '{{count}} EFs displayed',
                count: benchmarkData.chartData.length
              })
            : t('header.display.selected_points', {
                defaultValue: 'Display: {{selected}} points selected out of {{total}} EFs',
                selected: Math.min(displayMode, benchmarkData.chartData.length),
                total: benchmarkData.chartData.length
              })
          }
        </Badge>
        {displayMode < benchmarkData.chartData.length && benchmarkData.chartData.length > 25 && (
          <Badge variant="outline">
            {t('header.display.stratified_sample', 'Stratified representative sample')}
          </Badge>
        )}
      </div>

      {/* Modal de sauvegarde */}
      <BenchmarkSaveModal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        benchmarkData={benchmarkData}
        searchParams={searchParams}
      />
    </div>
  );
};

