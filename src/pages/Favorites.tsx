import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { UnifiedNavbar } from "@/components/ui/UnifiedNavbar";
import { ResultsTable } from "@/components/search/ResultsTable";
import { Button } from "@/components/ui/button";
import { EmissionFactor } from "@/types/emission-factor";
import { Heart, HeartOff } from "lucide-react";
import { useOptimizedFavorites } from "@/hooks/useOptimizedFavorites";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/ui/RoleGuard";
import { FavoritesFilterPanel, FavoritesFilters } from "@/components/search/FavorisFilterPanel";


const Favorites = () => {
  const { 
    favorites, 
    loading, 
    removeFromFavorites, 
    batchRemoveFavorites,
    filterFavorites,
    filterOptions,
    stats,
    getPerformanceMetrics
  } = useOptimizedFavorites();
  const { canExport } = usePermissions();
  const { toast } = useToast();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [filters, setFilters] = useState<FavoritesFilters>({
    search: '',
    source: '',
    localisation: '',
    date: '',
    importType: 'all'
  });

  // Use optimized filtering with memoization
  const filteredFavorites = useMemo(() => {
    return filterFavorites(filters);
  }, [filterFavorites, filters]);

  // Use optimized filter options
  const availableSources = filterOptions.sources;
  const availableLocations = filterOptions.locations;
  const availableDates = filterOptions.dates;

  const handleItemSelect = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedItems(
      selectedItems.length === filteredFavorites.length ? [] : filteredFavorites.map(f => f.id)
    );
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      await removeFromFavorites(id);
      setSelectedItems(prev => prev.filter(item => item !== id));
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
    const toRemove = selectedItems.slice();
    if (toRemove.length === 0) return;
    try {
      await batchRemoveFavorites(toRemove);
      setSelectedItems([]);
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

  const handleCopyToClipboard = async () => {
    try {
      const selectedFavorites = filteredFavorites.filter(f => selectedItems.includes(f.id));
      const headers = [
        "Nom", 
        "Description", 
        "FE", 
        "Unité donnée d'activité", 
        "Source", 
        "Secteur", 
        "Sous-secteur", 
        "Localisation", 
        "Date", 
        "Incertitude", 
        "Périmètre", 
        "Contributeur", 
        "Commentaires"
      ];
      const tsvContent = [
        headers.join("\t"),
        ...selectedFavorites.map(f => [
          f.nom || '',
          f.description || '',
          f.fe || '',
          f.uniteActivite || '',
          f.source || '',
          f.secteur || '',
          f.sousSecteur || '',
          f.localisation || '',
          f.date || '',
          f.incertitude || '',
          f.perimetre || '',
          f.contributeur || '',
          f.commentaires || ''
        ].join("\t"))
      ].join("\n");
      
      await navigator.clipboard.writeText(tsvContent);
      
      toast({
        title: "Copié dans le presse-papier",
        description: `${selectedFavorites.length} élément(s) copié(s). Vous pouvez maintenant les coller dans Excel ou Google Sheets.`,
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors de la copie dans le presse-papier",
      });
    }
  };

  const handleExport = async () => {
    if (!canExport) {
      toast({
        variant: "destructive",
        title: "Limite d'exports atteinte",
        description: "Veuillez upgrader votre abonnement pour continuer à exporter.",
      });
      return;
    }

    try {
      
      const selectedFavorites = filteredFavorites.filter(f => selectedItems.includes(f.id));
      const csvContent = [
        "Nom,FE,Unité donnée d'activité,Source,Localisation,Date",
        ...selectedFavorites.map(f => `"${f.nom}",${f.fe},"${f.uniteActivite}","${f.source}","${f.localisation}","${f.date}"`)
      ].join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mes_favoris_emissions.csv";
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export réalisé",
        description: "Vos favoris ont été exportés avec succès !",
      });
    } catch (error) {
      console.error('Error during export:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors de l'export",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <UnifiedNavbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center homepage-text">
            <Heart className="w-8 h-8 mr-3 text-red-500" />
            Mes favoris
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-muted-foreground">
              Retrouvez ici tous vos facteurs d'émissions carbone favoris
            </p>
            {!loading && favorites.length > 0 && (
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="font-semibold text-foreground">{stats.total}</span> favoris
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-semibold text-foreground">{stats.sources}</span> sources
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-semibold text-foreground">{stats.locations}</span> pays
                </span>
              </div>
            )}
          </div>
        </div>

        {loading ? (
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
        ) : favorites.length > 0 ? (
          <div>
            <FavoritesFilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              availableSources={availableSources}
              availableLocations={availableLocations}
              availableDates={availableDates}
            />
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                variant="destructive"
                onClick={handleRemoveSelectedFromFavorites}
                disabled={selectedItems.length === 0}
              >
                <HeartOff className="w-4 h-4 mr-2" />
                Retirer des favoris ({selectedItems.length})
              </Button>
              <RoleGuard requirePermission="canExport">
                <Button 
                  onClick={handleExport}
                  disabled={selectedItems.length === 0}
                >
                  Exporter la sélection ({selectedItems.length})
                </Button>
              </RoleGuard>
            </div>
            <ResultsTable
              results={filteredFavorites.map(fav => ({ ...fav, isFavorite: true }))}
              selectedItems={selectedItems}
              onItemSelect={handleItemSelect}
              onSelectAll={handleSelectAll}
              onToggleFavorite={handleToggleFavorite}
              onExport={handleExport}
              onCopyToClipboard={handleCopyToClipboard}
            />
          </div>
        ) : (
          <div className="text-center py-12">
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
        )}
      </div>
      
    </div>
  );
};

export default Favorites;