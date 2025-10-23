import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInstantSearch } from 'react-instantsearch';
import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQuotas } from '@/hooks/useQuotas';
import { useBenchmarkValidation } from '@/hooks/useBenchmarkValidation';
import { BenchmarkValidationAlert } from '@/components/benchmark/BenchmarkValidationAlert';

export const GenerateBenchmarkButton = () => {
  const { t } = useTranslation();
  const { results, indexUiState } = useInstantSearch();
  const { currentWorkspace } = useWorkspace();
  const { canGenerateBenchmark, quotaData } = useQuotas();
  const { validateBenchmark } = useBenchmarkValidation();

  const [isHovered, setIsHovered] = useState(false);
  const [validationError, setValidationError] = useState<any>(null);

  // Déterminer si le bouton doit être désactivé
  const query = indexUiState.query || '';
  const hasResults = results && results.nbHits > 0;
  const isFreePlan = currentWorkspace?.plan_type === 'freemium';
  const hasNoQuery = !query || query.trim() === '';

  // Déterminer la raison de la désactivation
  const getDisabledReason = () => {
    if (hasNoQuery) {
      return t('search:benchmark.errors.no_query', 'Please enter a search query');
    }
    if (!hasResults) {
      return t('search:benchmark.errors.no_results', 'No results found for this search');
    }
    if (isFreePlan && !canGenerateBenchmark) {
      return t('search:benchmark.errors.quota_exceeded', {
        defaultValue: `Quota exceeded ({{used}}/{{limit}}). Upgrade to Pro plan for unlimited benchmarks.`,
        used: quotaData?.benchmarks_used || 0,
        limit: quotaData?.benchmarks_limit || 3,
      });
    }
    return null;
  };

  const disabledReason = getDisabledReason();
  const isDisabled = !!disabledReason;

  const handleClick = () => {
    if (isDisabled) return;

    // Réinitialiser l'erreur précédente
    setValidationError(null);

    // Valider d'abord (synchrone maintenant)
    const validation = validateBenchmark();

    if (!validation.valid) {
      // Afficher l'erreur de validation
      setValidationError(validation.error);
      return;
    }

    // Si validation OK, construire les paramètres pour la page benchmark
    const searchParams = new URLSearchParams();
    searchParams.set('query', query);

    // Ajouter les filtres si présents
    if (indexUiState.refinementList) {
      searchParams.set('filters', JSON.stringify(indexUiState.refinementList));
    }

    // Ajouter les facetFilters si présents
    if (indexUiState.configure?.facetFilters) {
      searchParams.set('facetFilters', JSON.stringify(indexUiState.configure.facetFilters));
    }

    // Ouvrir le benchmark dans un nouvel onglet
    const url = `/benchmark/view?${searchParams.toString()}`;
    window.open(url, '_blank');
  };

  const buttonContent = (
    <Button
      onClick={handleClick}
      disabled={isDisabled}
      variant="default"
      size="sm"
      className="gap-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <BarChart3 className="h-4 w-4" />
      {t('search:benchmark.generate_button', 'Generate benchmark')}
    </Button>
  );

  // Si le bouton est désactivé, afficher un tooltip
  if (isDisabled) {
    return (
      <>
        <TooltipProvider>
          <Tooltip open={isHovered}>
            <TooltipTrigger asChild>
              {buttonContent}
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>{disabledReason}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {validationError && (
          <div className="mt-4">
            <BenchmarkValidationAlert
              error={validationError}
              onClose={() => setValidationError(null)}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {buttonContent}
      {validationError && (
        <div className="mt-4">
          <BenchmarkValidationAlert
            error={validationError}
            onClose={() => setValidationError(null)}
          />
        </div>
      )}
    </>
  );
};

