import React from 'react';
import { useRefinementList, useClearRefinements } from 'react-instantsearch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

import { RotateCcw, Filter, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useOrigin, useOptionalOrigin } from '@/components/search/algolia/SearchProvider';

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
          placeholder={`Rechercher ${title.toLowerCase()}...`}
          value={searchQuery}
          onChange={handleSearch}
          className="text-xs"
        />
      )}

      <div className="max-h-48 overflow-y-auto space-y-1">
        {items.length === 0 ? (
          <div className="text-xs text-gray-400">Aucune option disponible</div>
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

// Composant pour la sélection d'origine (IMPORTANT - à conserver)
const OriginFilter: React.FC = () => {
  const { origin, setOrigin } = useOrigin();

  const debug = (action: string) => {
    console.log(`[OriginFilter] ${action}`);
  };

    return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant={origin === 'all' ? 'default' : 'outline'}
        onClick={() => {
          debug('click all');
          setOrigin('all');
        }}
      >
        Tous
      </Button>
      <Button
        size="sm"
        variant={origin === 'public' ? 'default' : 'outline'}
        onClick={() => {
          debug('click public');
          setOrigin('public');
        }}
      >
        Base commune
      </Button>
      <Button
        size="sm"
        variant={origin === 'private' ? 'default' : 'outline'}
        onClick={() => {
          debug('click private');
          setOrigin('private');
        }}
      >
        Base personnelle
      </Button>
    </div>
  );
};

export const SearchFilters: React.FC = () => {
  const { refine: clearRefinements } = useClearRefinements();

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Filtres</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearRefinements()}
            className="text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Réinitialiser
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* ORIGINE - Logique métier critique à conserver */}
        <div className="space-y-2">
          <div className="text-sm font-semibold text-primary">Origine</div>
          <OriginFilter />
        </div>

        {/* LANGUE - Filtre Algolia standard */}
        <RefinementList
          attribute="languages"
          title="Langue"
          limit={10}
        />

        {/* FILTRES STANDARDS - Selon recommandations Algolia */}
        <RefinementList
          attribute="Source"
          title="Source"
          searchable
          limit={500}
        />

        <RefinementList
          attribute="Date"
          title="Date"
          limit={20}
        />

        <RefinementList
          attribute="Secteur_fr"
          title="Secteur"
          searchable
          limit={500}
        />

        <RefinementList
          attribute="Sous-secteur_fr"
          title="Sous-secteur"
          searchable
          limit={500}
        />

        <RefinementList
          attribute="Localisation_fr"
          title="Localisation"
          searchable
          limit={500}
        />

        <RefinementList
          attribute="Périmètre_fr"
          title="Périmètre"
          searchable
          limit={500}
        />

        <RefinementList
          attribute="Unite_fr"
          title="Unité"
          searchable
          limit={500}
        />

      </CardContent>
    </Card>
  );
};