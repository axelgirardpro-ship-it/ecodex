import React from 'react';
import { useRefinementList, useClearRefinements, useSearchBox } from 'react-instantsearch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { RotateCcw, Lock } from 'lucide-react';
import { useOrigin } from '@/components/search/algolia/SearchProvider';
import { useEmissionFactorAccess } from '@/hooks/useEmissionFactorAccess';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/providers/LanguageProvider';

interface LocalizedFilterConfig {
  attribute: string;
  label: string;
  searchable?: boolean;
  limit?: number;
}

const FILTERS_FR: LocalizedFilterConfig[] = [
  { attribute: 'Unite_fr', label: 'Unité', searchable: true, limit: 500 },
  { attribute: 'Source', label: 'Source', searchable: true, limit: 500 },
  { attribute: 'Localisation_fr', label: 'Localisation', searchable: true, limit: 500 },
  { attribute: 'Périmètre_fr', label: 'Périmètre', searchable: true, limit: 500 },
  { attribute: 'Date', label: 'Date', limit: 20 },
  { attribute: 'Type_de_données', label: 'Type de données', searchable: true, limit: 500 },
  { attribute: 'Secteur_fr', label: 'Secteur', searchable: true, limit: 500 },
  { attribute: 'Sous-secteur_fr', label: 'Sous-secteur', searchable: true, limit: 500 },
  { attribute: 'dataset_name', label: 'Dataset importé', searchable: true, limit: 500 },
];

const FILTERS_EN: LocalizedFilterConfig[] = [
  { attribute: 'Unite_en', label: 'Unit', searchable: true, limit: 500 },
  { attribute: 'Source', label: 'Source', searchable: true, limit: 500 },
  { attribute: 'Localisation_en', label: 'Location', searchable: true, limit: 500 },
  { attribute: 'Périmètre_en', label: 'Perimeter', searchable: true, limit: 500 },
  { attribute: 'Date', label: 'Date', limit: 20 },
  { attribute: 'Type_de_données_en', label: 'Data Type', searchable: true, limit: 500 },
  { attribute: 'Secteur_en', label: 'Sector', searchable: true, limit: 500 },
  { attribute: 'Sous-secteur_en', label: 'Sub-Sector', searchable: true, limit: 500 },
  { attribute: 'dataset_name', label: 'Imported Dataset', searchable: true, limit: 500 },
];

/**
 * Composant pour initialiser les filtres avec une recherche vide
 * Déclenche une recherche vide au chargement pour peupler les RefinementList
 */
const FiltersInitializer: React.FC = () => {
  const { refine } = useSearchBox();
  const { origin } = useOrigin();
  const [initialized, setInitialized] = React.useState(false);

  React.useEffect(() => {
    if (!initialized) {
      // Déclencher une recherche vide pour peupler les filtres
      setTimeout(() => {
        refine('*'); // Recherche universelle qui retourne tout
        setTimeout(() => {
          refine(''); // Revenir à vide après initialisation
          setInitialized(true);
        }, 100);
      }, 100);
    }
  }, [refine, initialized]);

  // Se réinitialiser quand l'origine change
  React.useEffect(() => {
    setInitialized(false);
  }, [origin]);

  return null; // Composant invisible
};

interface RefinementListProps {
  attribute: string;
  title: string;
  searchable?: boolean;
  limit?: number;
}

/**
 * RefinementList avec filtrage côté client
 * Solution simple et fonctionnelle en attendant une configuration Algolia optimale
 * 
 * FEATURE: Affiche un cadenas sur les sources payantes non assignées au workspace
 */
const RefinementList: React.FC<RefinementListProps> = ({
  attribute,
  title,
  searchable = false,
  limit = 500
}) => {
  const { items, refine } = useRefinementList({
    attribute,
    limit
  });

  const [searchQuery, setSearchQuery] = React.useState('');
  const { t } = useTranslation();
  
  // Récupérer les informations d'accès aux sources (seulement pour le filtre "Source")
  const { isSourceLocked } = useEmissionFactorAccess();
  const isSourceFilter = attribute === 'Source';

  // Filtrer les items localement basé sur la requête de recherche
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => 
      item.label.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-gray-500">
            {items.filter(item => item.isRefined).length > 0 &&
              `(${items.filter(item => item.isRefined).length})`
            }
          </span>
        </div>

        {searchable && (
          <Input
            type="text"
            placeholder={`Rechercher ${title.toLowerCase()}...`}
            value={searchQuery}
            onChange={handleSearch}
            className="text-xs h-8"
          />
        )}

        <div className="max-h-48 overflow-y-auto space-y-1">
          {filteredItems.length === 0 ? (
            <div className="text-xs text-gray-400">
              {searchQuery ? 'Aucun résultat' : '-'}
            </div>
          ) : (
            filteredItems.map(item => {
              const isLocked = isSourceFilter && isSourceLocked(item.value);
              
              return (
                <div key={item.value} className="flex items-center space-x-2 py-0.5">
                  <Checkbox
                    id={`${attribute}-${item.value}`}
                    checked={item.isRefined}
                    disabled={isLocked}
                    onCheckedChange={() => !isLocked && refine(item.value)}
                  />
                  <label
                    htmlFor={`${attribute}-${item.value}`}
                    className={`text-sm flex-1 truncate flex items-center gap-1.5 ${
                      isLocked 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'cursor-pointer'
                    }`}
                    title={isLocked ? undefined : item.label}
                  >
                    {isLocked && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center cursor-help">
                            <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p className="text-xs">
                            {t('search:filters.source_locked_tooltip')}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <span className="truncate">
                      {item.label} <span className="text-xs text-gray-500">({item.count})</span>
                    </span>
                  </label>
                </div>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

/**
 * Composant de sélection d'origine avec auto-refresh
 * 
 * FONCTIONNEMENT :
 * - 'public': Base commune (données gratuites + payantes selon assignations)
 * - 'private': Base personnelle (données importées par le workspace)
 * - Auto-refresh: changement d'origine relance automatiquement la recherche
 */
const OriginFilter: React.FC = () => {
  const { origin, setOrigin } = useOrigin();
  const { t } = useTranslation();

  const debug = (action: string) => {
    if (import.meta.env.DEV) {
      console.log(`[OriginFilter] ${action} - Auto-refresh activé`);
    }
  };

  const handleOriginChange = (newOrigin: 'public' | 'private') => {
    if (newOrigin !== origin) {
      debug(`Changement origine: ${origin} → ${newOrigin}`);
      setOrigin(newOrigin);
      // L'auto-refresh est géré par SearchProvider via useEffect sur origin
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant={origin === 'public' ? 'default' : 'outline'}
        onClick={() => handleOriginChange('public')}
        className="justify-start w-56 px-4 text-sm whitespace-nowrap overflow-hidden text-ellipsis"
      >
        {t('search:filters.origin_public')}
      </Button>
      <Button
        size="sm"
        variant={origin === 'private' ? 'default' : 'outline'}
        onClick={() => handleOriginChange('private')}
        title={undefined}
        className="justify-start w-56 px-4 text-sm whitespace-nowrap overflow-hidden text-ellipsis"
      >
        {t('search:filters.origin_private')}
      </Button>
    </div>
  );
};

export const SearchFilters: React.FC = () => {
  const { refine: clearRefinements } = useClearRefinements();
  const { language } = useLanguage();
  const { t } = useTranslation();

  const filters = language === 'en' ? FILTERS_EN : FILTERS_FR;

  return (
    <Card className="w-full">
      <FiltersInitializer />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{t('search:filters.title')}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearRefinements()}
            className="text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            {t('search:filters.reset')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-primary">{t('search:filters.origin')}</div>
          <OriginFilter />
        </div>

        {filters.map(({ attribute, label, searchable, limit }) => (
          <RefinementList
            key={attribute}
            attribute={attribute}
            title={label}
            searchable={searchable}
            limit={limit}
          />
        ))}
      </CardContent>
    </Card>
  );
};