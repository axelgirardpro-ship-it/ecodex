import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface BenchmarkValidationErrorProps {
  error: Error;
}

export const BenchmarkValidationError = ({ error }: BenchmarkValidationErrorProps) => {
  const { t } = useTranslation('benchmark');
  const navigate = useNavigate();

  // Déterminer le type d'erreur et le message approprié
  const getErrorMessage = () => {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('trial') || errorMessage.includes('essai')) {
      return t('errors.trial_expired');
    }
    if (errorMessage.includes('quota')) {
      return t('errors.quota_exceeded', { used: 3, limit: 3 });
    }
    if (errorMessage.includes('multiple units') || errorMessage.includes('plusieurs unités')) {
      return error.message;
    }
    if (errorMessage.includes('multiple scopes') || errorMessage.includes('plusieurs périmètres')) {
      return error.message;
    }
    if (errorMessage.includes('no results') || errorMessage.includes('aucun résultat')) {
      return t('errors.no_results');
    }

    return error.message || t('errors.generation_failed');
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            {t('errors.generation_failed')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription className="mt-2">
              {getErrorMessage()}
            </AlertDescription>
          </Alert>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={() => navigate('/search')}
              variant="default"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('errors.back_to_search')}
            </Button>
          </div>

          {error.stack && (
            <details className="mt-4">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                Détails techniques
              </summary>
              <pre className="mt-2 text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                {error.stack}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

