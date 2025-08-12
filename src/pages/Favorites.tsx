import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { UnifiedNavbar } from "@/components/ui/UnifiedNavbar";
import { Button } from "@/components/ui/button";
import { EmissionFactor } from "@/types/emission-factor";
import { Heart, HeartOff } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/ui/RoleGuard";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useQuotaActions } from "@/hooks/useQuotaActions";

// Import des composants Algolia
import { FavorisSearchProvider } from "@/components/search/favoris/FavorisSearchProvider";
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

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedItems(new Set(favoriteIds));
    } else {
      setSelectedItems(new Set());
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
        title: "Favori supprimé",
        description: "L'élément a été retiré de vos favoris",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors de la suppression du favori",
      });
    }
  };
  
  const handleRemoveSelectedFromFavorites = async () => {
    const toRemove = Array.from(selectedItems);
    if (toRemove.length === 0) return;
    
    try {
      await Promise.all(toRemove.map(id => removeFromFavorites(id)));
      setSelectedItems(new Set());
      toast({
        title: "Favoris mis à jour",
        description: `${toRemove.length} élément${toRemove.length > 1 ? 's' : ''} retiré${toRemove.length > 1 ? 's' : ''} des favoris.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors de la suppression des favoris sélectionnés",
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
                <p className="text-muted-foreground font-medium">Chargement de vos favoris...</p>
                <p className="text-sm text-muted-foreground/75">
                  Récupération des données depuis la base...
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
              Mes Favoris
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Recherchez et gérez vos facteurs d'émission favoris avec les filtres avancés
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
            )}
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-8">
        {favorites.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              Aucun favori pour le moment
            </h3>
            <p className="text-muted-foreground mb-6">
              Ajoutez des facteurs d'émissions à vos favoris depuis la page de recherche
            </p>
            <Button asChild>
              <Link to="/search">
                Commencer une recherche
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
                  Retirer des favoris ({selectedItems.size})
                </Button>
                <RoleGuard requirePermission="canExport">
                  <Button 
                    onClick={() => {
                      const selectedFavorites = favorites.filter(f => selectedItems.has(f.id));
                      handleExport(selectedFavorites);
                    }}
                    disabled={selectedItems.size === 0}
                  >
                    Exporter la sélection ({selectedItems.size})
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
                  Copier la sélection ({selectedItems.size})
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
                onToggleFavorite={handleToggleFavorite}
                favoriteIds={favoriteIds}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

const Favorites = () => {
  const { favorites } = useFavorites();
  
  // Extract favorite IDs for Algolia filtering
  const favoriteIds = useMemo(() => {
    return favorites.map(f => f.id);
  }, [favorites]);

  return (
    <FavorisSearchProvider favoriteIds={favoriteIds}>
      <FavoritesAlgoliaContent />
    </FavorisSearchProvider>
  );
};

export default Favorites;