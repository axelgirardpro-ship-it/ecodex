import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useBenchmarkStorage } from '@/hooks/useBenchmarkStorage';
import type { BenchmarkData } from '@/types/benchmark';

interface BenchmarkSaveModalProps {
  open: boolean;
  onClose: () => void;
  benchmarkData: BenchmarkData;
  searchParams: {
    query: string;
    filters?: Record<string, any>;
    facetFilters?: string[][];
  };
}

export const BenchmarkSaveModal = ({
  open,
  onClose,
  benchmarkData,
  searchParams,
}: BenchmarkSaveModalProps) => {
  const { t } = useTranslation('benchmark');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { saveBenchmark, isSaving } = useBenchmarkStorage();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Titre requis',
        description: 'Veuillez saisir un titre pour le benchmark',
        variant: 'destructive',
      });
      return;
    }

    try {
      const saved = await saveBenchmark({
        title: title.trim(),
        description: description.trim() || undefined,
        benchmarkData,
        searchParams,
      });

      toast({
        title: t('save.success'),
      });

      onClose();
      
      // Naviguer vers le benchmark sauvegardé
      navigate(`/benchmark/${saved.id}`);
    } catch (error) {
      console.error('Error saving benchmark:', error);
      toast({
        title: t('save.error'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('save.modal_title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('save.title_label')}</Label>
            <Input
              id="title"
              placeholder={t('save.title_placeholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('save.description_label')}</Label>
            <Textarea
              id="description"
              placeholder={t('save.description_placeholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-2" />
            {t('save.actions.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
          >
            <Save className="h-4 w-4 mr-2" />
            {t('save.actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

