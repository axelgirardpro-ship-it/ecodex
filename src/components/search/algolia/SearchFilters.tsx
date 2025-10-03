import React from 'react';
import { useRefinementList, useClearRefinements, useSearchBox } from 'react-instantsearch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

import { RotateCcw } from 'lucide-react';
import { useOrigin } from '@/components/search/algolia/SearchProvider';
import { usePermissions } from '@/hooks/usePermissions';
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

const RefinementList: React.FC<RefinementListProps> = ({
  attribute,
  title,
  searchable = false,
  limit = 100
}) => {
  const { items, refine, searchForItems } = useRefinementList({
    attribute,
    limit
  });

  // Debug pour comprendre pourquoi les items sont vides
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      console.log(`[RefinementList ${attribute}] items:`, items.length, items.slice(0, 3));
    }
  }, [items, attribute]);

  const [searchQuery, setSearchQuery] = React.useState('');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!searchable || !searchForItems) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) return; // seuil mini
    debounceRef.current = setTimeout(() => {
      searchForItems(query);
    }, 300);
  };

  React.useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return (
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
          placeholder={title}
          value={searchQuery}
          onChange={handleSearch}
          className="text-xs"
        />
      )}

      <div className="max-h-48 overflow-y-auto space-y-1">
        {items.length === 0 ? (
          <div className="text-xs text-gray-400">-</div>
        ) : (
          items.map(item => (
            <div key={item.value} className="flex items-center space-x-2">
              <Checkbox
                id={`${attribute}-${item.value}`}
                checked={item.isRefined}
                onCheckedChange={() => refine(item.value)}
              />
              <label
                htmlFor={`${attribute}-${item.value}`}
                className="text-sm cursor-pointer flex-1 truncate"
                title={item.label}
              >
                {item.label} ({item.count})
              </label>
            </div>
          ))
        )}
      </div>
    </div>
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