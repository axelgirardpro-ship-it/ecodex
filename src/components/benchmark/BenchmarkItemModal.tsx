import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatEmissionFactor } from '@/lib/formatters/benchmarkFormatters';
import type { BenchmarkEmissionFactor, BenchmarkChartDataPoint } from '@/types/benchmark';

interface BenchmarkItemModalProps {
  item: BenchmarkEmissionFactor | BenchmarkChartDataPoint | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BenchmarkItemModal = ({ item, isOpen, onClose }: BenchmarkItemModalProps) => {
  const { t } = useTranslation('benchmark');

  if (!item) return null;

  // Déterminer si c'est un BenchmarkEmissionFactor ou BenchmarkChartDataPoint
  const isFull = 'Nom_fr' in item;

  const fields = isFull
    ? [
        { key: 'name', value: (item as BenchmarkEmissionFactor).Nom_fr },
        { key: 'description', value: (item as BenchmarkEmissionFactor).Description_fr, isMarkdown: true },
        { key: 'value', value: formatEmissionFactor((item as BenchmarkEmissionFactor).FE) },
        { key: 'unit', value: (item as BenchmarkEmissionFactor).Unite_fr },
        { key: 'scope', value: (item as BenchmarkEmissionFactor).Périmètre_fr },
        { key: 'source', value: (item as BenchmarkEmissionFactor).Source },
        { key: 'year', value: (item as BenchmarkEmissionFactor).Date?.toString() },
        { key: 'location', value: (item as BenchmarkEmissionFactor).Localisation_fr },
        { key: 'sector', value: (item as BenchmarkEmissionFactor).Secteur_fr },
        { key: 'subsector', value: (item as BenchmarkEmissionFactor)['Sous-secteur_fr'] },
        { key: 'comments', value: (item as BenchmarkEmissionFactor).Commentaires_fr, isMarkdown: true },
        { key: 'methodology', value: (item as BenchmarkEmissionFactor).Méthodologie },
        { key: 'data_type', value: (item as BenchmarkEmissionFactor).Type_de_données },
        { key: 'contributor', value: (item as BenchmarkEmissionFactor).Contributeur },
      ]
    : [
        { key: 'name', value: (item as BenchmarkChartDataPoint).name },
        { key: 'description', value: (item as BenchmarkChartDataPoint).description, isMarkdown: true },
        { key: 'value', value: formatEmissionFactor((item as BenchmarkChartDataPoint).fe) },
        { key: 'unit', value: (item as BenchmarkChartDataPoint).unit },
        { key: 'scope', value: (item as BenchmarkChartDataPoint).scope },
        { key: 'source', value: (item as BenchmarkChartDataPoint).source },
        { key: 'year', value: (item as BenchmarkChartDataPoint).date?.toString() },
        { key: 'location', value: (item as BenchmarkChartDataPoint).localisation },
        { key: 'sector', value: (item as BenchmarkChartDataPoint).sector },
        { key: 'comments', value: (item as BenchmarkChartDataPoint).comments, isMarkdown: true },
      ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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
                  {field.isMarkdown ? (
                    <div className="text-base text-foreground">
                      <ReactMarkdown
                        components={{
                          a: ({ href, children, ...props }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                              {...props}
                            >
                              {children}
                            </a>
                          ),
                          p: ({ children, ...props }) => (
                            <p className="text-base leading-relaxed" {...props}>
                              {children}
                            </p>
                          ),
                          strong: ({ children, ...props }) => (
                            <strong className="font-bold" {...props}>{children}</strong>
                          ),
                          em: ({ children, ...props }) => (
                            <em className="italic" {...props}>{children}</em>
                          ),
                        }}
                      >
                        {field.value}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-base text-foreground">{field.value}</p>
                  )}
                </div>
              )
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose} variant="outline">
            <X className="h-4 w-4 mr-2" />
            {t('modal.actions.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

