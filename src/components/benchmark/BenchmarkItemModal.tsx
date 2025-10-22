import { useTranslation } from 'react-i18next';
import { Copy, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { BenchmarkEmissionFactor, BenchmarkChartDataPoint } from '@/types/benchmark';

interface BenchmarkItemModalProps {
  item: BenchmarkEmissionFactor | BenchmarkChartDataPoint | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BenchmarkItemModal = ({ item, isOpen, onClose }: BenchmarkItemModalProps) => {
  const { t } = useTranslation('benchmark');
  const { toast } = useToast();

  if (!item) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(item.objectID);
    toast({
      title: t('modal.copy_success'),
    });
  };

  // Déterminer si c'est un BenchmarkEmissionFactor ou BenchmarkChartDataPoint
  const isFull = 'Nom_fr' in item;

  const fields = isFull
    ? [
        { key: 'name', value: (item as BenchmarkEmissionFactor).Nom_fr },
        { key: 'description', value: (item as BenchmarkEmissionFactor).Description_fr },
        { key: 'value', value: `${(item as BenchmarkEmissionFactor).FE.toFixed(4)}` },
        { key: 'unit', value: (item as BenchmarkEmissionFactor).Unite_fr },
        { key: 'scope', value: (item as BenchmarkEmissionFactor).Périmètre_fr },
        { key: 'source', value: (item as BenchmarkEmissionFactor).Source },
        { key: 'year', value: (item as BenchmarkEmissionFactor).Date?.toString() },
        { key: 'location', value: (item as BenchmarkEmissionFactor).Localisation_fr },
        { key: 'sector', value: (item as BenchmarkEmissionFactor).Secteur_fr },
        { key: 'subsector', value: (item as BenchmarkEmissionFactor)['Sous-secteur_fr'] },
        { key: 'comments', value: (item as BenchmarkEmissionFactor).Commentaires_fr },
        { key: 'methodology', value: (item as BenchmarkEmissionFactor).Méthodologie },
        { key: 'data_type', value: (item as BenchmarkEmissionFactor).Type_de_données },
        { key: 'contributor', value: (item as BenchmarkEmissionFactor).Contributeur },
      ]
    : [
        { key: 'name', value: (item as BenchmarkChartDataPoint).name },
        { key: 'value', value: `${(item as BenchmarkChartDataPoint).fe.toFixed(4)}` },
        { key: 'unit', value: (item as BenchmarkChartDataPoint).unit },
        { key: 'scope', value: (item as BenchmarkChartDataPoint).scope },
        { key: 'source', value: (item as BenchmarkChartDataPoint).source },
        { key: 'year', value: (item as BenchmarkChartDataPoint).date?.toString() },
        { key: 'location', value: (item as BenchmarkChartDataPoint).localisation },
        { key: 'sector', value: (item as BenchmarkChartDataPoint).sector },
      ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('modal.details_title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {fields.map(
            (field) =>
              field.value && (
                <div key={field.key}>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {t(`modal.fields.${field.key}`)}
                  </p>
                  <p className="text-base text-foreground">{field.value}</p>
                </div>
              )
          )}

          <div className="pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Object ID
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted p-2 rounded font-mono">
                {item.objectID}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyId}
              >
                <Copy className="h-4 w-4 mr-2" />
                {t('modal.actions.copy_id')}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose} variant="outline">
            <X className="h-4 w-4 mr-2" />
            {t('modal.actions.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

