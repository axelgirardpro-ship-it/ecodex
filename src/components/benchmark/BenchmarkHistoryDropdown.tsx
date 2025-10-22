import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { History, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBenchmarkStorage } from '@/hooks/useBenchmarkStorage';
import { useToast } from '@/hooks/use-toast';
import { useTranslation as useI18n } from 'react-i18next';

interface BenchmarkHistoryDropdownProps {
  onClose: () => void;
}

export const BenchmarkHistoryDropdown = ({ onClose }: BenchmarkHistoryDropdownProps) => {
  const { t } = useTranslation('benchmark');
  const { i18n } = useI18n();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { history, isLoadingHistory, deleteBenchmark, isDeleting } = useBenchmarkStorage();

  const handleLoad = (id: string) => {
    navigate(`/benchmark/${id}`);
    onClose();
  };

  const handleDelete = async (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm(t('history.delete_confirm'))) {
      return;
    }

    try {
      await deleteBenchmark(id);
      toast({
        title: 'Benchmark supprimé',
        description: `"${title}" a été supprimé avec succès`,
      });
    } catch (error) {
      console.error('Error deleting benchmark:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le benchmark',
        variant: 'destructive',
      });
    }
  };

  const dateLocale = i18n.language === 'fr' ? fr : enUS;

  return (
    <div className="p-2">
      <div className="flex items-center gap-2 px-2 pb-2 border-b">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">{t('history.title')}</h3>
      </div>

      {isLoadingHistory ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !history || history.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          {t('history.empty')}
        </div>
      ) : (
        <ScrollArea className="h-[400px] mt-2">
          <div className="space-y-1">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer group"
                onClick={() => handleLoad(item.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), 'PPp', { locale: dateLocale })}
                    </p>
                    <span className="text-xs text-muted-foreground">•</span>
                    <p className="text-xs text-muted-foreground">
                      {t('history.item.sample_size', { count: item.sample_size })}
                    </p>
                    <span className="text-xs text-muted-foreground">•</span>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.unit}
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleDelete(item.id, item.title, e)}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

