import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';

interface BenchmarkExportPNGProps {
  benchmarkContainerId: string;
  filename?: string;
}

export const BenchmarkExportPNG = ({
  benchmarkContainerId,
  filename = 'benchmark',
}: BenchmarkExportPNGProps) => {
  const { t } = useTranslation('benchmark');
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const element = document.getElementById(benchmarkContainerId);
      if (!element) {
        throw new Error('Benchmark container not found');
      }

      // Générer le canvas avec une meilleure qualité
      const canvas = await html2canvas(element, {
        scale: 2, // Meilleure résolution
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      });

      // Convertir en blob
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Failed to generate PNG');
        }

        // Télécharger
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}-${new Date().getTime()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: t('export.png.success'),
        });
      }, 'image/png');
    } catch (error) {
      console.error('Error exporting PNG:', error);
      toast({
        title: t('export.png.error'),
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
        <Download className="h-4 w-4 mr-2" />
      )}
      {t('export.png.button')}
    </Button>
  );
};

