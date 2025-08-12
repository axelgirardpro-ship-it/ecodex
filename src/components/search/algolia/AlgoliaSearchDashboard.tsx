import React from 'react';
import { SearchProvider } from './SearchProvider';
import { SearchBox } from './SearchBox';
import { SearchResults } from './SearchResults';
import { SearchFilters } from './SearchFilters';
import { SearchStats } from './SearchStats';
import { UnifiedNavbar } from '@/components/ui/UnifiedNavbar';

const AlgoliaSearchContent: React.FC = () => {
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
            <SearchStats />
            <SearchResults />
          </section>
        </div>
      </main>
    </div>
  );
};

export const SearchDashboard: React.FC = () => {
  return (
    <SearchProvider>
      <AlgoliaSearchContent />
    </SearchProvider>
  );
};