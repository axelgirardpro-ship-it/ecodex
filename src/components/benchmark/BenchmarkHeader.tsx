import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BenchmarkSaveModal } from './BenchmarkSaveModal';
import { BenchmarkHistoryDropdown } from './BenchmarkHistoryDropdown';
import { BenchmarkShare } from './BenchmarkShare';
import { useToast } from '@/hooks/use-toast';
import type { BenchmarkData } from '@/types/benchmark';

interface BenchmarkHeaderProps {
  title: string;
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
  benchmarkData,
  searchParams,
  savedBenchmarkId,
  benchmarkContainerId = 'benchmark-content',
}: BenchmarkHeaderProps) => {
  const { t } = useTranslation('benchmark');
  const { toast } = useToast();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);

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
          <BenchmarkShare benchmarkId={savedBenchmarkId} searchParams={searchParams} />
        </div>
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

