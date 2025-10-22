import { useTranslation } from 'react-i18next';
import { AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ValidationError {
  code: 'MULTIPLE_UNITS' | 'MULTIPLE_SCOPES' | 'NO_UNIT_OR_SCOPE' | 'INSUFFICIENT_DATA' | 'UNKNOWN';
  message: string;
  details?: any;
}

interface BenchmarkValidationAlertProps {
  error: ValidationError;
  onClose: () => void;
}

export const BenchmarkValidationAlert = ({ error, onClose }: BenchmarkValidationAlertProps) => {
  const { t, i18n } = useTranslation('benchmark');
  const isEnglish = i18n.language === 'en';

  const getAlertConfig = () => {
    switch (error.code) {
      case 'MULTIPLE_UNITS':
        const units = error.details?.units || [];
        return {
          icon: Info,
          variant: 'default' as const,
          title: isEnglish ? 'Specify the unit' : 'Précisez l\'unité',
          message: isEnglish 
            ? `Your search returns ${units.length} different units. Use the filters on the left to select a single unit.`
            : `Votre recherche retourne ${units.length} unités différentes. Utilisez les filtres sur la gauche pour sélectionner une seule unité.`,
          color: 'text-blue-600',
        };
      case 'MULTIPLE_SCOPES':
        const scopes = error.details?.scopes || [];
        return {
          icon: Info,
          variant: 'default' as const,
          title: isEnglish ? 'Specify the scope' : 'Précisez le périmètre',
          message: isEnglish
            ? `Your search returns ${scopes.length} different scopes. Use the filters on the left to select a single scope.`
            : `Votre recherche retourne ${scopes.length} périmètres différents. Utilisez les filtres sur la gauche pour sélectionner un seul périmètre.`,
          color: 'text-blue-600',
        };
      case 'NO_UNIT_OR_SCOPE':
        return {
          icon: Info,
          variant: 'default' as const,
          title: isEnglish ? 'Missing information' : 'Informations manquantes',
          message: isEnglish
            ? 'The emission factors found do not contain a valid unit or scope. Adjust your search or filters.'
            : 'Les facteurs d\'émission trouvés ne contiennent pas d\'unité ou de périmètre valide. Ajustez votre recherche ou vos filtres.',
          color: 'text-blue-600',
        };
      case 'INSUFFICIENT_DATA':
        const count = error.details?.count || 0;
        return {
          icon: Info,
          variant: 'default' as const,
          title: isEnglish ? 'Not enough data' : 'Pas assez de données',
          message: isEnglish
            ? `Your search returns ${count} emission factor${count > 1 ? 's' : ''}. At least 3 are needed to generate a benchmark. ${count === 0 ? 'Try broadening your search or removing filters.' : 'Broaden your search criteria slightly.'}`
            : `Votre recherche retourne ${count} facteur${count > 1 ? 's' : ''} d'émission. Au moins 3 sont nécessaires pour générer un benchmark. ${count === 0 ? 'Élargissez votre recherche ou retirez des filtres.' : 'Élargissez légèrement vos critères de recherche.'}`,
          color: 'text-amber-600',
        };
      default:
        return {
          icon: AlertCircle,
          variant: 'default' as const,
          title: isEnglish ? 'Validation inconclusive' : 'Validation non concluante',
          message: error.message || (isEnglish ? 'We were unable to validate the data. Check your query and filters.' : 'Nous n\'avons pas pu valider les données. Vérifiez votre requête et filtres.'),
          color: 'text-amber-600',
        };
    }
  };

  const config = getAlertConfig();
  const Icon = config.icon;

  return (
    <Alert variant={config.variant} className="relative">
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 ${config.color} mt-0.5 flex-shrink-0`} />
        <div className="flex-1">
          <AlertTitle className="text-sm font-semibold mb-1">{config.title}</AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            {config.message}
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
};

