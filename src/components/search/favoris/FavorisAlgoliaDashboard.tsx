import React, { useState, useMemo } from 'react';
import { OriginProvider } from '@/components/search/algolia/SearchProvider';
import { SearchProvider } from '@/components/search/algolia/SearchProvider';
import { FavorisSearchBox } from './FavorisSearchBox';
import { FavorisSearchResults } from './FavorisSearchResults';
import { SearchFilters } from '@/components/search/algolia/SearchFilters';
import { FavorisSearchStats } from './FavorisSearchStats';
import { UnifiedNavbar } from '@/components/ui/UnifiedNavbar';
import { Configure } from 'react-instantsearch';
import { useOptionalOrigin } from '@/components/search/algolia/SearchProvider';
import { buildFavoriteIdsFilter } from '@/lib/algolia/searchClient';
import { EmissionFactor } from '@/types/emission-factor';
import { useFavorites } from '@/contexts/FavoritesContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useQuotaActions } from '@/hooks/useQuotaActions';
import { RoleGuard } from '@/components/ui/RoleGuard';
import { Button } from '@/components/ui/button';
import { Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface FavorisAlgoliaContentProps {
  favoriteIds: string[];
}

const FavorisAlgoliaContent: React.FC<FavorisAlgoliaContentProps> = ({ favoriteIds }) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const { favorites, removeFromFavorites } = useFavorites();
  const { handleExport: quotaHandleExport, handleCopyToClipboard: quotaHandleCopyToClipboard } = useQuotaActions();

  const handleItemSelect = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (ids: string[], selected: boolean) => {
    if (selected) {
      setSelectedItems(new Set(ids));
    } else {
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        ids.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  const handleCopyToClipboard = async (items: EmissionFactor[]) => {
    await quotaHandleCopyToClipboard(items);
  };

  const handleExport = async (items: EmissionFactor[]) => {
    await quotaHandleExport(items, 'facteurs_emissions_favoris');
  };

  const handleRemoveSelectedFromFavorites = async (itemIds: string[]) => {
    try {
      // Remove items from favorites one by one
      for (const itemId of itemIds) {
        await removeFromFavorites(itemId);
      }
      
      // Clear selection
      setSelectedItems(new Set());
      
      toast.success(`${itemIds.length} élément${itemIds.length > 1 ? 's' : ''} retiré${itemIds.length > 1 ? 's' : ''} des favoris`);
    } catch (error) {
      toast.error('Erreur lors de la suppression des favoris');
    }
  };

  // Get unique sources, locations, and dates from favorites
  const availableSources = [...new Set(favorites.map(f => f.source))].filter(Boolean);
  const availableLocations = [...new Set(favorites.map(f => f.localisation))].filter(Boolean);
  const availableDates = [...new Set(favorites.map(f => f.date.toString()))].filter(Boolean).sort((a, b) => parseInt(b) - parseInt(a));

  const favoriteIdsFilter = buildFavoriteIdsFilter(favoriteIds);
  const originCtx = useOptionalOrigin();
  const currentOrigin = originCtx?.origin || 'all';

  return (
    <div className="min-h-screen bg-background">
      <UnifiedNavbar />
      
      {/* Header Section */}
      <section className="py-12 px-4 bg-background border-b">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Mes Favoris
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Recherchez et gérez vos facteurs d'émission favoris
            </p>
            
            {/* Search Box */}
            <div className="max-w-3xl mx-auto">
              <FavorisSearchBox favoriteIds={favoriteIds} />
            </div>
            
            {/* Summary Stats */}
            <div className="flex justify-center items-center gap-8 mt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{favorites.length}</span>
                <span>favoris au total</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{availableSources.length}</span>
                <span>sources</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{availableLocations.length}</span>
                <span>localisations</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-8">
        {favorites.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-muted-foreground text-lg mb-4">
              Vous n'avez pas encore de favoris.
            </div>
            <div className="text-muted-foreground">
              Recherchez des facteurs d'émission et ajoutez-les à vos favoris en cliquant sur ❤️
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filters Sidebar */}
            <aside className="lg:col-span-1">
              <SearchFilters />
            </aside>

            {/* Results Section */}
            <section className="lg:col-span-3">
              <Configure filters={favoriteIdsFilter} ruleContexts={[`origin:${currentOrigin}`]} />
              <FavorisSearchStats />
              <FavorisSearchResults
                selectedItems={selectedItems}
                onItemSelect={handleItemSelect}
                onSelectAll={handleSelectAll}
                onExport={handleExport}
                onCopyToClipboard={handleCopyToClipboard}
                onRemoveSelectedFromFavorites={handleRemoveSelectedFromFavorites}
                favoriteIds={favoriteIds}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export const FavorisAlgoliaDashboard: React.FC = () => {
  const { favorites } = useFavorites();
  const favoriteIds = useMemo(() => favorites.map(f => f.id), [favorites]);

  return (
    <OriginProvider>
      <SearchProvider>
        <FavorisAlgoliaContent favoriteIds={favoriteIds} />
      </SearchProvider>
    </OriginProvider>
  );
};