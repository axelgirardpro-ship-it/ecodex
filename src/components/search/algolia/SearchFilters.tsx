import React from 'react';
import { useRefinementList, useClearRefinements, useToggleRefinement, useRange, usePagination, Configure } from 'react-instantsearch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
  limit = 10 
}) => {
  const { items, refine, searchForItems, canToggleShowMore, isShowingMore, toggleShowMore } = 
    useRefinementList({ attribute, limit });
  
  // État local pour la recherche avec fallback côté client
  const [searchQuery, setSearchQuery] = React.useState('');
  const [allItems, setAllItems] = React.useState(items);

  // Mettre à jour les items complets quand ils changent
  React.useEffect(() => {
    if (!searchQuery) {
      setAllItems(items);
    }
  }, [items, searchQuery]);

  // Trier les dates par ordre décroissant si c'est l'attribut Date
  const sortedItems = React.useMemo(() => {
    if (attribute === 'Date') {
      return [...items].sort((a, b) => {
        const dateA = parseInt(a.label);
        const dateB = parseInt(b.label);
        return dateB - dateA; // Ordre décroissant
      });
    }
    return items;
  }, [items, attribute]);

  // Filtrer côté client si nécessaire
  const filteredItems = React.useMemo(() => {
    if (!searchQuery) return sortedItems;
    
    // Si searchForItems ne fonctionne pas, filtrer côté client
    return allItems.filter(item => 
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sortedItems, allItems, searchQuery]);

  if (items.length === 0) return null;

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-0 h-auto text-indigo-950 hover:bg-white hover:text-indigo-950">
          <h5 className="text-base font-semibold font-montserrat text-primary">{title}</h5>
          <Filter className="h-4 w-4 text-indigo-950" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-2">
        {searchable && (
          <Input
            type="search"
            placeholder={`Rechercher ${title.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => {
              const query = e.target.value;
              setSearchQuery(query);
              // Essayer d'abord la recherche serveur Algolia
              searchForItems(query);
            }}
            className="w-full px-3 py-1 text-sm"
          />
        )}
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {filteredItems.map((item) => (
            <div key={item.value} className="flex items-center space-x-2">
              <Checkbox
                id={`${attribute}-${item.value}`}
                checked={item.isRefined}
                onCheckedChange={() => refine(item.value)}
                className="border-indigo-950 data-[state=checked]:bg-indigo-950 data-[state=checked]:border-indigo-950"
              />
              <label
                htmlFor={`${attribute}-${item.value}`}
                className="flex-1 text-sm cursor-pointer flex justify-between"
              >
                <span className={item.isRefined ? 'font-medium' : ''}>{item.label}</span>
                <span className="text-muted-foreground">({item.count})</span>
              </label>
            </div>
          ))}
        </div>
        {canToggleShowMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleShowMore}
            className="w-full"
          >
            {isShowingMore ? 'Voir moins' : 'Voir plus'}
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

const ClearRefinementsWidget: React.FC = () => {
  const { canRefine, refine } = useClearRefinements();
  
  if (!canRefine) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={refine}
      className="text-indigo-950 hover:text-indigo-800 font-montserrat bg-white hover:bg-white"
    >
      <RotateCcw className="w-4 h-4 mr-1" />
      RÉINITIALISER LES FILTRES
    </Button>
  );
};

const RecentDataToggle: React.FC = () => {
  const { value, refine } = useToggleRefinement({
    attribute: 'Date',
    on: [2022, 2023, 2024, 2025]
  });

  return (
    <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-border">
      <Switch
        checked={value.isRefined}
        onCheckedChange={() => refine(value)}
        id="recent-data"
        className="data-[state=checked]:bg-indigo-950"
      />
      <label htmlFor="recent-data" className="text-sm font-medium cursor-pointer font-montserrat text-indigo-950">
        Données récentes (&lt; 3 ans)
      </label>
    </div>
  );
};

const FERangeInput: React.FC = () => {
  const { start, range, canRefine, refine } = useRange({
    attribute: 'FE',
    precision: 2
  });
  const { refine: refinePage } = usePagination();

  const [min, setMin] = React.useState('');
  const [max, setMax] = React.useState('');
  

  // Synchroniser avec les valeurs du range seulement si elles sont valides
  React.useEffect(() => {
    if (start && Array.isArray(start)) {
      const startMin = start[0];
      const startMax = start[1];
      
      // Gérer les objets de type Number avec des valeurs spéciales
      const parseValue = (value: any) => {
        if (typeof value === 'object' && value?._type === 'Number') {
          const strValue = String(value.value);
          if (strValue === '-Infinity' || strValue === 'Infinity' || strValue === 'NaN') {
            return null;
          }
          const numValue = parseFloat(value.value);
          return isNaN(numValue) ? null : numValue;
        }
        if (typeof value === 'number') {
          return value === -Infinity || value === Infinity || isNaN(value) ? null : value;
        }
        return null;
      };
      
      const minValue = parseValue(startMin);
      const maxValue = parseValue(startMax);
      
      // Seulement définir des valeurs valides
      if (minValue !== null) {
        setMin(minValue.toString());
      }
      if (maxValue !== null) {
        setMax(maxValue.toString());
      }
    }
  }, [start]);

  const handleSubmit = () => {
    const toNumber = (v: string) => {
      if (v === '') return undefined;
      const normalized = v.replace(',', '.').trim();
      const num = Number(normalized);
      return Number.isFinite(num) ? num : undefined;
    };

    let minValue = toNumber(min);
    let maxValue = toNumber(max);

    // Clamp to available FE range if known
    if (range && typeof range.min === 'number' && typeof range.max === 'number') {
      if (minValue !== undefined) minValue = Math.max(range.min, minValue);
      if (maxValue !== undefined) maxValue = Math.min(range.max, maxValue);
    }

    // If both are defined and inverted, swap
    if (
      minValue !== undefined &&
      maxValue !== undefined &&
      minValue > maxValue
    ) {
      const tmp = minValue;
      minValue = maxValue;
      maxValue = tmp;
    }

    console.log('🔎 Applying FE range', { minValue, maxValue, available: range });
    refine([minValue, maxValue]);
    refinePage(0);
  };

  const handleReset = () => {
    setMin('');
    setMax('');
    refine([undefined, undefined]);
    refinePage(0);
  };

  console.log('FERangeInput - canRefine:', canRefine, 'range:', range, 'start:', start);

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-0 h-auto text-indigo-950 bg-transparent hover:bg-transparent">
          <h5 className="text-base font-semibold font-montserrat text-primary">Facteur d'émission (FE)</h5>
          <Filter className="h-4 w-4 text-indigo-950" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 mt-2">
        {range && range.min !== undefined && range.max !== undefined && (
          <div className="text-xs text-muted-foreground">
            Plage actuelle: {range.min?.toLocaleString()} à {range.max?.toLocaleString()}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Min</label>
            <Input
              type="number"
              placeholder="Min"
              value={min}
              inputMode="decimal"
              step="0.01"
              onChange={(e) => setMin(e.target.value.replace(',', '.'))}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Max</label>
            <Input
              type="number"
              placeholder="Max"
              value={max}
              inputMode="decimal"
              step="0.01"
              onChange={(e) => setMax(e.target.value.replace(',', '.'))}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={handleSubmit} className="flex-1">
            Appliquer
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const OriginFilter: React.FC = () => {
  const ctx = useOptionalOrigin();
  const origin = ctx?.origin ?? 'all';
  const setOrigin = ctx?.setOrigin ?? (() => {});
  const { refine: refinePage } = usePagination();
  const debug = (...args: any[]) => { if (import.meta.env.DEV) console.log('[OriginFilter]', ...args); };

  // On passe par ruleContexts pour ne pas polluer facetFilters
  const ruleContexts = React.useMemo(() => {
    const rc = origin === 'all' ? undefined : [`origin:${origin}`];
    // Log seulement si ruleContexts change et n'est pas undefined
    if (import.meta.env.DEV && rc !== undefined) {
      debug('ruleContexts:', rc);
    }
    return rc;
  }, [origin]);

  // Reset page when origin changes to avoid landing on an empty page
  React.useEffect(() => {
    debug('origin changed →', origin);
    refinePage(0);
  }, [origin, refinePage]);

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2">
        <Button
          size="sm"
          variant={origin === 'all' ? 'default' : 'outline'}
          onClick={() => { debug('click all'); setOrigin('all'); refinePage(0); }}
        >
          Tous
        </Button>
        <Button
          size="sm"
          variant={origin === 'public' ? 'default' : 'outline'}
          onClick={() => { debug('click public'); setOrigin('public'); refinePage(0); }}
        >
          Base commune
        </Button>
        <Button
          size="sm"
          variant={origin === 'private' ? 'default' : 'outline'}
          onClick={() => { debug('click private'); setOrigin('private'); refinePage(0); }}
        >
          Base personnelle
        </Button>
      </div>

      {/* Paramètre virtuel pour le provider (intercepté avant Algolia) */}
      <Configure ruleContexts={ruleContexts} />
    </div>
  );
};

export const SearchFilters: React.FC = () => {
  // Sélecteur de langue local (évite de créer un widget RefinementList doublon)
  const [lang, setLang] = React.useState<'fr'|'en'>('fr');
  const searchable = React.useMemo(() => (
    lang === 'fr'
      ? ['Nom_fr','Description_fr','Commentaires_fr','Secteur_fr','Sous-secteur_fr','Périmètre_fr','Localisation_fr']
      : ['Nom_en','Description_en','Commentaires_en','Secteur_en','Sous-secteur_en','Périmètre_en','Localisation_en']
  ), [lang]);

  const languageFacetFilters = React.useMemo(() => [[`languages:${lang}`]] as string[][], [lang]);
  const languageFilterString = React.useMemo(() => `languages:${lang}`, [lang]);

  return (
    <Card className="bg-background border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-montserrat text-indigo-950">FILTRER PAR :</CardTitle>
        <ClearRefinementsWidget />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Piloter facets & searchable côté requête */}
        <Configure filters={languageFilterString} restrictSearchableAttributes={searchable} />
        {/* Langue - segmented control */}
        <div className="space-y-2">
          <div className="text-sm font-semibold text-primary">Langue</div>
          <div className="flex gap-2">
            <Button size="sm" variant={lang==='fr'?'default':'outline'} onClick={() => setLang('fr')}>FR</Button>
            <Button size="sm" variant={lang==='en'?'default':'outline'} onClick={() => setLang('en')}>EN</Button>
          </div>
        </div>
        <Collapsible defaultOpen>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-between p-0 h-auto text-indigo-950 bg-transparent hover:bg-transparent"
            >
              <h5 className="text-base font-semibold font-montserrat text-primary">Données récentes</h5>
              <Filter className="h-4 w-4 text-indigo-950" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            <RecentDataToggle />
          </CollapsibleContent>
        </Collapsible>

        {/* Filtre d'origine (virtuel) */}
        {/* Origine – segmented control inline */}
        <div className="space-y-2">
          <div className="text-sm font-semibold text-primary">Origine</div>
          <OriginFilter />
        </div>

        {/* 
        TEMPORAIREMENT DÉSACTIVÉ - Filtre FE (Facteur d'Émission)
        
        Court terme : Désactiver temporairement le filtre FE en attendant la re-synchronisation entre Supabase et Algolia 
        Long terme : Re-synchroniser l'index Algolia avec les données Supabase actuelles
        Cause identifiée : Les objectID stockés dans Supabase n'existent pas dans l'index Algolia
        
        <FERangeInput />
        */}
        <RefinementList
          attribute={lang === 'fr' ? 'Unite_fr' : 'Unite_en'}
          title="Unité"
          searchable
          limit={500}
        />
        <RefinementList
          attribute={lang === 'fr' ? 'Périmètre_fr' : 'Périmètre_en'}
          title="Périmètre"
          searchable
          limit={500}
        />
        <RefinementList
          attribute="Source"
          title="Source"
          searchable
          limit={500}
        />
        <RefinementList
          attribute="Date"
          title="Date"
          limit={500}
        />
        <RefinementList
          attribute={lang === 'fr' ? 'Localisation_fr' : 'Localisation_en'}
          title="Localisation"
          searchable
          limit={500}
        />
        <RefinementList
          attribute={lang === 'fr' ? 'Secteur_fr' : 'Secteur_en'}
          title="Secteur"
          searchable
          limit={500}
        />
        <RefinementList
          attribute={lang === 'fr' ? 'Sous-secteur_fr' : 'Sous-secteur_en'}
          title="Sous-secteur"
          searchable
          limit={500}
        />
      </CardContent>
    </Card>
  );
};