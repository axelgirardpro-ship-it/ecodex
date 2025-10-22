import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { BenchmarkPDFDocument } from './BenchmarkPDFDocument';
import type { BenchmarkData } from '@/types/benchmark';

interface BenchmarkExportPDFProps {
  benchmarkData: BenchmarkData;
  title?: string;
}

export const BenchmarkExportPDF = ({
  benchmarkData,
  title = 'Benchmark',
}: BenchmarkExportPDFProps) => {
  const { t } = useTranslation('benchmark');
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      // Générer le document PDF
      const doc = <BenchmarkPDFDocument data={benchmarkData} title={title} />;
      const asPdf = pdf(doc);
      const blob = await asPdf.toBlob();

      // Télécharger
      const filename = `${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().getTime()}.pdf`;
      saveAs(blob, filename);

      toast({
        title: t('export.pdf.success'),
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: t('export.pdf.error'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4 mr-2" />
      )}
      {t('export.pdf.button')}
    </Button>
  );
};

