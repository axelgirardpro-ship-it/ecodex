import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UnifiedNavbar } from '@/components/ui/UnifiedNavbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, BarChart, Calendar, Trash2 } from 'lucide-react';
import { useBenchmarkStorage } from '@/hooks/useBenchmarkStorage';
import { useLanguage } from '@/providers/LanguageProvider';
import { buildLocalizedPath } from '@i18n/routing';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const BenchmarkHub = () => {
  const { t } = useTranslation('benchmark');
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { toast } = useToast();
  const { history, isLoadingHistory, deleteBenchmark } = useBenchmarkStorage();

  const handleNewBenchmark = () => {
    navigate(buildLocalizedPath('/search', language));
  };

  const handleViewBenchmark = (id: string) => {
    navigate(buildLocalizedPath(`/benchmark/${id}`, language));
  };

  const handleDeleteBenchmark = async (id: string, title: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le benchmark "${title}" ?`)) {
      return;
    }

    try {
      await deleteBenchmark(id);
      toast({
        title: 'Benchmark supprimé',
        description: `Le benchmark "${title}" a été supprimé avec succès.`,
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le benchmark.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <UnifiedNavbar />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {t('hub.title', 'My Benchmarks')}
              </h1>
              <p className="text-muted-foreground">
                {t('hub.subtitle', 'Manage your benchmark analyses and create new ones')}
              </p>
            </div>
            <Button onClick={handleNewBenchmark} size="lg">
              <Plus className="h-5 w-5 mr-2" />
              {t('hub.new_benchmark', 'New Benchmark')}
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoadingHistory ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : history && history.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((benchmark) => (
              <Card 
                key={benchmark.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer group"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2 group-hover:text-primary transition-colors">
                        {benchmark.title}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(benchmark.created_at), 'dd MMM yyyy', { locale: fr })}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBenchmark(benchmark.id, benchmark.title);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent onClick={() => handleViewBenchmark(benchmark.id)}>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{benchmark.unit}</Badge>
                      <Badge variant="outline">{benchmark.sample_size} FE</Badge>
                    </div>
                    <Button variant="outline" className="w-full" size="sm">
                      <BarChart className="h-4 w-4 mr-2" />
                      Voir le benchmark
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                <BarChart className="h-16 w-16 text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    {t('hub.empty.title', 'No benchmarks')}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {t('hub.empty.description', 'Start by creating your first benchmark from the search page')}
                  </p>
                  <Button onClick={handleNewBenchmark}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('hub.empty.create_button', 'Create a Benchmark')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BenchmarkHub;

