import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Save, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
    filters?: Record<string, string | number | boolean>;
    facetFilters?: string[][];
  };
  savedBenchmarkId?: string;
  benchmarkContainerId?: string;
  onTitleChange?: (newTitle: string) => void;
}

export const BenchmarkHeader = ({
  title,
  benchmarkData,
  searchParams,
  savedBenchmarkId,
  benchmarkContainerId = 'benchmark-content',
  onTitleChange,
}: BenchmarkHeaderProps) => {
  const { t } = useTranslation('benchmark');
  const { toast } = useToast();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus l'input quand on passe en mode édition
  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  // Mettre à jour le titre local quand le prop change
  useEffect(() => {
    setEditedTitle(title);
  }, [title]);

  const handleSaveTitle = () => {
    const trimmedTitle = editedTitle.trim();
    if (trimmedTitle && trimmedTitle !== title && onTitleChange) {
      onTitleChange(trimmedTitle);
      toast({
        title: t('header.title_updated', 'Titre mis à jour'),
        description: t('header.title_updated_desc', 'Le titre du benchmark a été modifié.'),
      });
    } else {
      // Restaurer le titre original si vide ou inchangé
      setEditedTitle(title);
    }
    setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setEditedTitle(title);
      setIsEditingTitle(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 group">
            {isEditingTitle ? (
              <Input
                ref={inputRef}
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={handleKeyDown}
                className="text-2xl font-bold h-auto py-1 px-2"
                placeholder={t('header.title_placeholder', 'Titre du benchmark')}
              />
            ) : (
              <>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="max-w-[600px] overflow-hidden">
                        <h1 className="text-2xl font-bold text-foreground truncate">
                          {title}
                        </h1>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-lg">
                      <p className="whitespace-normal break-words">{title}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 flex-shrink-0"
                  onClick={() => setIsEditingTitle(true)}
                  title={t('header.edit_title', 'Éditer le titre')}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
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

