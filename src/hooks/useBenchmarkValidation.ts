import { useInstantSearch } from 'react-instantsearch';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useEmissionFactorAccess } from '@/hooks/useEmissionFactorAccess';

interface ValidationError {
  code: 'MULTIPLE_UNITS' | 'MULTIPLE_SCOPES' | 'NO_UNIT_OR_SCOPE' | 'INSUFFICIENT_DATA' | 'INSUFFICIENT_ACCESSIBLE_DATA' | 'UNKNOWN';
  message: string;
  details?: any;
}

interface ValidationResult {
  valid: boolean;
  error?: ValidationError;
}

export const useBenchmarkValidation = () => {
  const { results, indexUiState } = useInstantSearch();
  const { currentWorkspace } = useWorkspace();
  const { assignedSources } = useEmissionFactorAccess();

  const validateBenchmark = (): ValidationResult => {
    try {
      // Utiliser les facets déjà disponibles dans les résultats de recherche
      if (!results) {
        return {
          valid: false,
          error: {
            code: 'UNKNOWN',
            message: 'Aucun résultat disponible',
          },
        };
      }

      // Vérifier le nombre de résultats
      if (results.nbHits < 3) {
        return {
          valid: false,
          error: {
            code: 'INSUFFICIENT_DATA',
            message: 'Pas assez de résultats',
            details: { count: results.nbHits },
          },
        };
      }

      // Vérifier combien de FEs sont réellement accessibles (non floutés/verrouillés)
      const accessibleHits = results.hits.filter((hit: any) => {
        // Exclure les FEs teaser
        if (hit.variant === 'teaser' || hit.is_blurred === true) {
          return false;
        }

        // Si c'est une source payante, vérifier l'assignation
        if (hit.access_level === 'paid') {
          const source = hit.Source || hit.source;
          return assignedSources.includes(source);
        }

        // Les FEs publiques sont toujours accessibles
        return true;
      });

      console.log('🔐 Validation accessibilité:', {
        totalHits: results.nbHits,
        accessibleCount: accessibleHits.length,
        assignedSources,
      });

      if (accessibleHits.length < 10) {
        return {
          valid: false,
          error: {
            code: 'INSUFFICIENT_ACCESSIBLE_DATA',
            message: 'Pas assez de facteurs d\'émission accessibles',
            details: { 
              totalCount: results.nbHits,
              accessibleCount: accessibleHits.length,
              requiredCount: 10,
            },
          },
        };
      }

      // Vérifier les FILTRES ACTIFS de l'utilisateur
      const activeFilters = indexUiState.refinementList || {};
      
      // Si l'utilisateur a déjà filtré sur une seule unité et un seul périmètre, c'est OK
      const selectedUnits = activeFilters['Unite_fr'] || [];
      const selectedScopes = activeFilters['Périmètre_fr'] || [];

      console.log('🔍 Validation benchmark:', {
        nbHits: results.nbHits,
        selectedUnits,
        selectedScopes,
        activeFilters,
      });

      // Si aucun filtre actif, on doit vérifier combien d'unités/périmètres UNIQUES dans les résultats
      // Pour cela, on utilise les facets
      const unitsFacets = results.disjunctiveFacets?.find((f: any) => f.name === 'Unite_fr');
      const scopesFacets = results.disjunctiveFacets?.find((f: any) => f.name === 'Périmètre_fr');

      // Si pas de filtre unité actif, vérifier qu'il n'y a qu'une seule unité dans les résultats
      let units: string[];
      if (selectedUnits.length > 0) {
        // L'utilisateur a déjà filtré
        units = selectedUnits;
      } else {
        // Pas de filtre actif, compter les unités avec des résultats
        units = unitsFacets?.data 
          ? Object.entries(unitsFacets.data)
              .filter(([_, count]) => (count as number) > 0)
              .map(([name, _]) => name)
          : [];
      }

      // Si pas de filtre périmètre actif, vérifier qu'il n'y a qu'un seul périmètre dans les résultats
      let scopes: string[];
      if (selectedScopes.length > 0) {
        // L'utilisateur a déjà filtré
        scopes = selectedScopes;
      } else {
        // Pas de filtre actif, compter les périmètres avec des résultats
        scopes = scopesFacets?.data 
          ? Object.entries(scopesFacets.data)
              .filter(([_, count]) => (count as number) > 0)
              .map(([name, _]) => name)
          : [];
      }

      if (units.length > 1) {
        return {
          valid: false,
          error: {
            code: 'MULTIPLE_UNITS',
            message: 'Unités multiples détectées',
            details: { units },
          },
        };
      }

      if (scopes.length > 1) {
        return {
          valid: false,
          error: {
            code: 'MULTIPLE_SCOPES',
            message: 'Périmètres multiples détectés',
            details: { scopes },
          },
        };
      }

      if (units.length === 0 || scopes.length === 0) {
        return {
          valid: false,
          error: {
            code: 'NO_UNIT_OR_SCOPE',
            message: 'Aucune unité ou périmètre trouvé',
            details: { units, scopes },
          },
        };
      }

      return { valid: true };
    } catch (error) {
      console.error('Benchmark validation error:', error);
      return {
        valid: false,
        error: {
          code: 'UNKNOWN',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  };

  return {
    validateBenchmark,
  };
};

