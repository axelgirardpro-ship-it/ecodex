import React from 'react';
import { Configure, useHitsPerPage, useInstantSearch } from 'react-instantsearch';
import { SearchProvider } from './SearchProvider';
import { SearchBox } from './SearchBox';
import { SearchResults } from './SearchResults';
import { SearchFilters } from './SearchFilters';
import { SearchStats } from './SearchStats';
import { UnifiedNavbar } from '@/components/ui/UnifiedNavbar';
import { GenerateBenchmarkButton } from '../GenerateBenchmarkButton';
import { useOrigin } from './SearchProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from 'react-i18next';

const HitsPerPageSelector: React.FC = () => {
  const { t } = useTranslation('search');
  const { refresh } = useInstantSearch();
  const { items, refine } = useHitsPerPage({
    items: [
      { label: '10', value: 10, default: false },
      { label: '25', value: 25, default: true },
      { label: '50', value: 50, default: false },
    ],
  });

  const currentValue = items.find(item => item.isRefined)?.value.toString() || '25';

  const handleChange = (value: string) => {
    refine(Number(value));
    // Force un refresh pour garantir que tous les paramètres (incluant maxValuesPerFacet) sont envoyés
    setTimeout(() => {
      refresh();
    }, 100);
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t('results.results_per_page', { defaultValue: 'Résultats par page' })}:</span>
      <Select value={currentValue} onValueChange={handleChange}>
        <SelectTrigger className="w-20 h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value.toString()}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const AlgoliaSearchContent: React.FC = () => {
  const { origin } = useOrigin();
  const { language } = useLanguage();
  const configureProps = React.useMemo(() => {
    const commonAttributes = [
      'objectID',
      'scope',
      'access_level',
      'Source',
      'Date',
      'FE',
      'Incertitude',
      'workspace_id',
      'is_blurred'
    ];

    const fallbackAttributes = [
      'Nom',
      'Description',
      'Commentaires',
      'Secteur',
      'Sous-secteur',
      'Périmètre',
      'Localisation',
      "Unité donnée d'activité",
      'Contributeur',
      'Méthodologie',
      'Type_de_données'
    ];

    const localized = language === 'en'
      ? [
          'Nom_en',
          'Description_en',
          'Commentaires_en',
          'Secteur_en',
          'Sous-secteur_en',
          'Périmètre_en',
          'Localisation_en',
          'Unite_en',
          'Contributeur_en',
          'Méthodologie_en',
          'Type_de_données_en'
        ]
      : [
          'Nom_fr',
          'Description_fr',
          'Commentaires_fr',
          'Secteur_fr',
          'Sous-secteur_fr',
          'Périmètre_fr',
          'Localisation_fr',
          'Unite_fr',
          'Contributeur',
          'Méthodologie',
          'Type_de_données'
        ];

    const searchableAttributes = language === 'en'
      ? ['Nom_en', 'Description_en', 'Commentaires_en']
      : ['Nom_fr', 'Description_fr', 'Commentaires_fr'];
    // Inclure TOUS les attributs possibles (avec fallbacks) pour garantir le highlighting sur tous les hits
    const highlightAttributes = language === 'en'
      ? ['Nom_en', 'Nom', 'Description_en', 'Description', 'Commentaires_en', 'Commentaires']
      : ['Nom_fr', 'Nom', 'Description_fr', 'Description', 'Commentaires_fr', 'Commentaires'];

    const base = {
      // NOTE: hitsPerPage est géré par useHitsPerPage dans HitsPerPageSelector, ne pas le définir ici
      // NOTE: facets n'est PAS défini ici car les widgets useRefinementList déclarent déjà implicitement les facettes
      maxValuesPerFacet: 1500, // Synchronisé avec la config Algolia backend pour couvrir toutes les facettes (notamment Localisation_fr: 1395 valeurs)
      ruleContexts: [`origin:${origin}`] as string[],
      attributesToRetrieve: [...commonAttributes, ...localized, ...fallbackAttributes] as string[],
      attributesToHighlight: highlightAttributes as string[],
      restrictSearchableAttributes: searchableAttributes as string[]
    };

    return base;
  }, [origin, language]);

  return (
    <div className="min-h-screen bg-background">
      <UnifiedNavbar />
      
      {/* Hero Section */}
      <section className="py-20 px-4 bg-primary">
        <div className="container mx-auto px-4">
          <div className="flex justify-center">
            {/* SearchBox - très large */}
            <div className="w-full max-w-6xl">
              <SearchBox />
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-8">
        {/* Search Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-1">
            <SearchFilters />
          </aside>

          {/* Results Section */}
          <section className="lg:col-span-3">
            <Configure {...configureProps} />
            <div className="flex justify-between items-center mb-2">
              <SearchStats />
              <HitsPerPageSelector />
            </div>
            <div className="mb-4">
              <GenerateBenchmarkButton />
            </div>
            <SearchResults />
          </section>
        </div>
      </main>
    </div>
  );
};

export const SearchDashboard: React.FC = () => {
  const { language } = useLanguage();

  return (
    <SearchProvider key={`search-${language}`}>
      <AlgoliaSearchContent />
    </SearchProvider>
  );
};