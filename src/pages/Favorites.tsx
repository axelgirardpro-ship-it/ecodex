import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UnifiedNavbar } from "@/components/ui/UnifiedNavbar";
import { Button } from "@/components/ui/button";
import { EmissionFactor } from "@/types/emission-factor";
import { Heart, HeartOff } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/ui/RoleGuard";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useQuotaActions } from "@/hooks/useQuotaActions";
import { useSafeLanguage } from "@/hooks/useSafeLanguage";
import { buildLocalizedPath } from "@/lib/i18n/routing";

// Import des composants Algolia
import { OriginProvider, SearchProvider } from "@/components/search/algolia/SearchProvider";
import { FavorisSearchBox } from "@/components/search/favoris/FavorisSearchBox";
import { FavorisSearchResults } from "@/components/search/favoris/FavorisSearchResults";
import { SearchFilters } from "@/components/search/algolia/SearchFilters";
import { FavorisSearchStats } from "@/components/search/favoris/FavorisSearchStats";

const FavoritesAlgoliaContent: React.FC = () => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const { favorites, loading, removeFromFavorites } = useFavorites();
  const { canExport } = usePermissions();
  const { toast } = useToast();
  const { handleExport: quotaHandleExport, handleCopyToClipboard: quotaHandleCopyToClipboard } = useQuotaActions();
  const { t } = useTranslation('pages', { keyPrefix: 'favorites' });
  const language = useSafeLanguage();

  // Extract favorite IDs for Algolia filtering
  const favoriteIds = useMemo(() => {
    return favorites.map(f => f.id);
  }, [favorites]);

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

  const handleToggleFavorite = async (id: string) => {
    try {
      await removeFromFavorites(id);
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      toast({
        title: t('toasts.removed.title'),
        description: t('toasts.removed.description'),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('toasts.removeError.title'),
        description: t('toasts.removeError.description'),
      });
    }
  };
  
  const handleRemoveSelectedFromFavorites = async () => {
    const toRemove = Array.from(selectedItems);
    if (toRemove.length === 0) return;
    
    try {
      // Supprimer en série pour garantir la cohérence UI + provider (évite collisions debounce/refresh)
      for (const id of toRemove) {
        // eslint-disable-next-line no-await-in-loop
        await removeFromFavorites(id);
      }
      setSelectedItems(new Set());
      toast({
        title: t('toasts.bulkRemoved.title'),
        description: toRemove.length === 1
          ? t('toasts.bulkRemoved.description', { count: toRemove.length })
          : t('toasts.bulkRemoved.description_plural', { count: toRemove.length }),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('toasts.bulkError.title'),
        description: t('toasts.bulkError.description'),
      });
    }
  };

  const handleCopyToClipboard = async (items: EmissionFactor[]) => {
    await quotaHandleCopyToClipboard(items);
  };

  const handleExport = async (items: EmissionFactor[]) => {
    await quotaHandleExport(items, 'facteurs_emissions_favoris');
  };

  // Get unique sources, locations, and dates from favorites for stats
  const availableSources = [...new Set(favorites.map(f => f.source))].filter(Boolean);
  const availableLocations = [...new Set(favorites.map(f => f.localisation))].filter(Boolean);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <UnifiedNavbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <div className="space-y-2">
                <p className="text-muted-foreground font-medium">{t('loading.title')}</p>
                <p className="text-sm text-muted-foreground/75">
                  {t('loading.subtitle')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <UnifiedNavbar />
      
      {/* Header Section */}
      <section className="py-12 px-4 bg-background border-b">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-foreground mb-4 flex items-center justify-center">
              <Heart className="w-10 h-10 mr-3 text-red-500" />
              {t('header.title')}
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              {t('header.subtitle')}
            </p>
            
            {/* Search Box - Seulement si on a des favoris */}
            {favorites.length > 0 && (
              <div className="max-w-3xl mx-auto">
                <FavorisSearchBox favoriteIds={favoriteIds} />
              </div>
            )}
            
            {/* Summary Stats */}
            {favorites.length > 0 && (
              <div className="flex justify-center items-center gap-8 mt-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{favorites.length}</span>
                  <span>{t('stats.favorites')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{availableSources.length}</span>
                  <span>{t('stats.sources')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{availableLocations.length}</span>
                  <span>{t('stats.locations')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-8">
        {favorites.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {t('empty.title')}
            </h3>
            <p className="text-muted-foreground mb-6">
              {t('empty.description')}
            </p>
            <Button asChild>
              <Link to={buildLocalizedPath('/search', language)}>
                {t('empty.cta')}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filters Sidebar */}
            <aside className="lg:col-span-1">
              <SearchFilters />
            </aside>

            {/* Results Section */}
            <section className="lg:col-span-3">
              <FavorisSearchStats />
              
              {/* Actions buttons */}
              <div className="mb-4 flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  onClick={handleRemoveSelectedFromFavorites}
                  disabled={selectedItems.size === 0}
                >
                  <HeartOff className="w-4 h-4 mr-2" />
                  {selectedItems.size === 0
                    ? t('actions.remove')
                    : t('actions.removeCount', { count: selectedItems.size })}
                </Button>
                <RoleGuard requirePermission="canExport">
                  <Button 
                    onClick={() => {
                      const selectedFavorites = favorites.filter(f => selectedItems.has(f.id));
                      handleExport(selectedFavorites);
                    }}
                    disabled={selectedItems.size === 0}
                  >
                    {selectedItems.size === 0
                      ? t('actions.export')
                      : t('actions.exportCount', { count: selectedItems.size })}
                  </Button>
                </RoleGuard>
                <Button
                  variant="outline"
                  onClick={() => {
                    const selectedFavorites = favorites.filter(f => selectedItems.has(f.id));
                    handleCopyToClipboard(selectedFavorites);
                  }}
                  disabled={selectedItems.size === 0}
                >
                  {selectedItems.size === 0
                    ? t('actions.copy')
                    : t('actions.copyCount', { count: selectedItems.size })}
                </Button>
              </div>
              
              <FavorisSearchResults
                selectedItems={selectedItems}
                onItemSelect={handleItemSelect}
                onSelectAll={handleSelectAll}
                onExport={handleExport}
                onCopyToClipboard={handleCopyToClipboard}
                onRemoveSelectedFromFavorites={async (itemIds: string[]) => {
                  await Promise.all(itemIds.map(id => removeFromFavorites(id)));
                  setSelectedItems(new Set());
                }}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

const Favorites = () => {
  return (
    <OriginProvider>
      <SearchProvider>
        <FavoritesAlgoliaContent />
      </SearchProvider>
    </OriginProvider>
  );
};

export default Favorites;