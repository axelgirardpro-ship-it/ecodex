import React from 'react';
import { Configure } from 'react-instantsearch';
import { SearchProvider } from './SearchProvider';
import { SearchBox } from './SearchBox';
import { SearchResults } from './SearchResults';
import { SearchFilters } from './SearchFilters';
import { SearchStats } from './SearchStats';
import { UnifiedNavbar } from '@/components/ui/UnifiedNavbar';
import { useOrigin } from './SearchProvider';
import { useLanguage } from '@/providers/LanguageProvider';

const AlgoliaSearchContent: React.FC = () => {
  const { origin } = useOrigin();
  const { language } = useLanguage();
  const configureProps = React.useMemo(() => {
    const commonAttributes = [
      'objectID',
      'Source',
      'Date',
      'FE',
      'Incertitude',
      'dataset_name',
      'workspace_id',
      'import_type',
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
    const highlightAttributes = language === 'en'
      ? ['Nom_en', 'Description_en', 'Commentaires_en']
      : ['Nom_fr', 'Description_fr', 'Commentaires_fr'];

    const base = {
      hitsPerPage: 100, // Augmenté pour afficher tous les hits pertinents d'Algolia
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
            <SearchStats />
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