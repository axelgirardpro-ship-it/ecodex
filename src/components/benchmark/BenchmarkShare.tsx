import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface BenchmarkShareProps {
  benchmarkId?: string;
  searchParams?: {
    query: string;
    filters?: Record<string, any>;
    facetFilters?: string[][];
  };
}

export const BenchmarkShare = ({ benchmarkId, searchParams }: BenchmarkShareProps) => {
  const { t } = useTranslation('benchmark');
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Construire l'URL de partage
  const shareUrl = benchmarkId 
    ? `${window.location.origin}/benchmark/${benchmarkId}`
    : (() => {
        if (!searchParams) return window.location.href;
        const params = new URLSearchParams();
        params.set('query', searchParams.query);
        if (searchParams.filters) {
          params.set('filters', JSON.stringify(searchParams.filters));
        }
        if (searchParams.facetFilters) {
          params.set('facetFilters', JSON.stringify(searchParams.facetFilters));
        }
        return `${window.location.origin}/benchmark/view?${params.toString()}`;
      })();

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: t('share.copy_success'),
      });

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast({
        title: t('share.copy_error'),
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4 mr-2" />
        {t('share.button')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('share.modal_title')}</DialogTitle>
            <DialogDescription>{t('share.modal_description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="share-url">{t('share.url_label')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="share-url"
                  value={shareUrl}
                  readOnly
                  className="flex-1"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyUrl}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>{t('share.workspace_info')}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

