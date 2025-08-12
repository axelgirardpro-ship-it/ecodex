import React, { useState, useEffect } from 'react';
import { useHits, usePagination } from 'react-instantsearch';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, Download, Copy, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { EmissionFactor } from '@/types/emission-factor';
import { useFavorites } from '@/contexts/FavoritesContext';
import { usePermissions } from '@/hooks/usePermissions';
import { RoleGuard } from '@/components/ui/RoleGuard';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useSourceLogos } from '@/hooks/useSourceLogos';
import type { AlgoliaHit } from '@/types/algolia';

interface FavorisSearchResultsProps {
  selectedItems: Set<string>;
  onItemSelect: (itemId: string) => void;
  onSelectAll: (selected: boolean) => void;
  onExport?: (items: EmissionFactor[]) => void;
  onCopyToClipboard?: (items: EmissionFactor[]) => void;
  onRemoveSelectedFromFavorites?: (itemIds: string[]) => void;
  onToggleFavorite?: (itemId: string) => void;
  favoriteIds: string[];
}

export const FavorisSearchResults: React.FC<FavorisSearchResultsProps> = ({
  selectedItems,
  onItemSelect,
  onSelectAll,
  onExport,
  onCopyToClipboard,
  onRemoveSelectedFromFavorites,
  onToggleFavorite,
  favoriteIds,
}) => {
  const { hits: originalHits } = useHits<AlgoliaHit>();
  const [currentSort, setCurrentSort] = useState<string>('relevance');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Function to sort hits based on current sort option
  const sortHits = React.useCallback((hits: AlgoliaHit[], sortKey: string): AlgoliaHit[] => {
    if (sortKey === 'relevance') return hits; // Keep Algolia's relevance order
    
    return [...hits].sort((a, b) => {
      switch (sortKey) {
        case 'fe_asc':
          return (a.FE || 0) - (b.FE || 0);
        case 'fe_desc':
          return (b.FE || 0) - (a.FE || 0);
        case 'date_desc':
          return (b.Date || 0) - (a.Date || 0);
        case 'date_asc':
          return (a.Date || 0) - (b.Date || 0);
        case 'nom_asc':
          return (a.Nom || '').localeCompare(b.Nom || '', 'fr', { numeric: true, sensitivity: 'base' });
        case 'nom_desc':
          return (b.Nom || '').localeCompare(a.Nom || '', 'fr', { numeric: true, sensitivity: 'base' });
        case 'source_asc':
          return (a.Source || '').localeCompare(b.Source || '', 'fr', { numeric: true, sensitivity: 'base' });
        default:
          return 0;
      }
    });
  }, []);

  // Apply sorting to hits
  const hits = React.useMemo(() => {
    return sortHits(originalHits, currentSort);
  }, [originalHits, currentSort, sortHits]);

  const handleSortChange = (sortKey: string) => {
    setCurrentSort(sortKey);
  };

  const sortOptions = [
    { label: 'Pertinence', value: 'relevance' },
    { label: 'FE croissant', value: 'fe_asc' },
    { label: 'FE décroissant', value: 'fe_desc' },
    { label: 'Plus récent', value: 'date_desc' },
    { label: 'Plus ancien', value: 'date_asc' },
    { label: 'Nom A-Z', value: 'nom_asc' },
    { label: 'Nom Z-A', value: 'nom_desc' },
    { label: 'Source A-Z', value: 'source_asc' },
  ];
  
  const { currentRefinement: currentPage, nbPages, refine: paginationRefine } = usePagination();
  const { removeFromFavorites, isFavorite } = useFavorites();
  const { canExport } = usePermissions();
  const { getSourceLogo } = useSourceLogos();

  const allSelected = hits.length > 0 && hits.every(hit => selectedItems.has(hit.objectID));
  
  const handleSelectAllChange = (checked: boolean) => {
    onSelectAll(checked);
  };

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getHighlightedText = (hit: AlgoliaHit, attribute: string) => {
    if (hit._highlightResult && hit._highlightResult[attribute] && hit._highlightResult[attribute].value) {
      return { __html: hit._highlightResult[attribute].value };
    }
    return { __html: hit[attribute as keyof AlgoliaHit] || '' };
  };

  const handleToggleFavorite = async (hit: AlgoliaHit) => {
    try {
      await removeFromFavorites(hit.objectID);
      toast.success('Retiré des favoris');
    } catch (error) {
      toast.error('Erreur lors de la suppression du favori');
    }
  };

  const mapHitToEmissionFactor = (hit: AlgoliaHit): EmissionFactor => ({
    id: hit.objectID,
    nom: hit.Nom,
    description: hit.Description,
    fe: hit.FE,
    uniteActivite: hit['Unité donnée d\'activité'],
    source: hit.Source,
    secteur: hit.Secteur,
    sousSecteur: hit['Sous-secteur'],
    localisation: hit.Localisation,
    date: hit.Date,
    incertitude: hit.Incertitude,
    perimetre: hit.Périmètre,
    contributeur: hit.Contributeur,
    commentaires: hit.Commentaires,
  });

  const handleExport = () => {
    if (onExport) {
      const selectedHits = hits.filter(hit => selectedItems.has(hit.objectID));
      const mappedHits = selectedHits.map(mapHitToEmissionFactor);
      onExport(mappedHits);
    }
  };

  const handleCopyToClipboard = () => {
    if (onCopyToClipboard) {
      const selectedHits = hits.filter(hit => selectedItems.has(hit.objectID));
      const mappedHits = selectedHits.map(mapHitToEmissionFactor);
      onCopyToClipboard(mappedHits);
    }
  };

  const handleRemoveSelected = () => {
    if (onRemoveSelectedFromFavorites) {
      const selectedIds = Array.from(selectedItems);
      onRemoveSelectedFromFavorites(selectedIds);
    }
  };

  const isPrivateHit = (hit: AlgoliaHit) => {
    return Boolean((hit as any).workspace_id) || (hit as any).import_type === 'imported' || (hit as any).__indexName === 'ef_private_fr';
  };

  if (hits.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">
          Aucun favori ne correspond à votre recherche.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="text-sm text-foreground">
          {hits.length} favori{hits.length > 1 ? 's' : ''} affiché{hits.length > 1 ? 's' : ''}
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground">Trier par:</span>
            <Select 
              value={currentSort} 
              onValueChange={handleSortChange}
            >
              <SelectTrigger className="w-auto min-w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Selection Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="select-all"
            checked={allSelected}
            onCheckedChange={handleSelectAllChange}
          />
          <label htmlFor="select-all" className="text-sm cursor-pointer">
            Tout sélectionner ({hits.length})
          </label>
        </div>
        
        {selectedItems.size > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyToClipboard}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier ({selectedItems.size})
            </Button>
            
            <RoleGuard requirePermission="canExport">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
              >
                <Download className="w-4 h-4 mr-2" />
                Exporter ({selectedItems.size})
              </Button>
            </RoleGuard>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemoveSelected}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Retirer ({selectedItems.size})
            </Button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-4">
        {hits.map((hit) => {
          const isExpanded = expandedRows.has(hit.objectID);
          const isFav = isFavorite(hit.objectID);

          return (
            <Card key={hit.objectID} className="relative overflow-hidden bg-background border border-border hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <Checkbox
                      checked={selectedItems.has(hit.objectID)}
                      onCheckedChange={() => onItemSelect(hit.objectID)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex flex-col items-start gap-1">
                          <h3 
                            className="text-lg font-semibold text-primary leading-tight"
                            dangerouslySetInnerHTML={getHighlightedText(hit, 'Nom')}
                          />
                          {isPrivateHit(hit) && (
                            <Badge variant="secondary" className="mt-1 text-[10px] leading-none px-2 py-0.5">
                              FE importé
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(hit);
                            }}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Heart className="h-4 w-4 fill-current" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowExpansion(hit.objectID);
                            }}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-3">
                        <div>
                          <span className="text-sm font-semibold text-foreground">Facteur d'émission</span>
                          <p className="text-2xl font-bold text-primary">
                            {hit.FE ? (typeof hit.FE === 'number' ? parseFloat(hit.FE.toFixed(4)) : parseFloat(parseFloat(String(hit.FE)).toFixed(4))).toLocaleString('fr-FR') : ''} kgCO₂eq
                          </p>
                          <div className="mt-2">
                            <span className="text-sm font-semibold text-foreground">Unité</span>
                            <p className="text-sm font-light" dangerouslySetInnerHTML={getHighlightedText(hit, 'Unité donnée d\'activité')} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {hit.Périmètre && (
                            <div>
                              <span className="text-sm font-semibold text-foreground">Périmètre</span>
                              <p className="text-sm font-light">{hit.Périmètre}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-sm font-semibold text-foreground">Source</span>
                            <div className="flex items-center gap-2">
                              {getSourceLogo(hit.Source) && (
                                <img 
                                  src={getSourceLogo(hit.Source)!}
                                  alt={`Logo ${hit.Source}`}
                                  className="w-6 h-6 object-contain flex-shrink-0"
                                />
                              )}
                              <p className="text-sm font-light" dangerouslySetInnerHTML={getHighlightedText(hit, 'Source')} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {hit.Localisation && <Badge variant="outline">{hit.Localisation}</Badge>}
                        {hit.Date && <Badge variant="outline">{hit.Date}</Badge>}
                        {hit.Secteur && <Badge variant="outline">{hit.Secteur}</Badge>}
                        {hit['Sous-secteur'] && <Badge variant="secondary">{hit['Sous-secteur']}</Badge>}
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t space-y-3">
                          {hit.Description && (
                            <div>
                              <span className="text-sm font-semibold text-foreground">Description</span>
                              <div className="text-xs mt-1 text-break-words">
                                <ReactMarkdown 
                                  components={{
                                    a: ({ href, children, ...props }) => (
                                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline" {...props}>
                                        {children}
                                      </a>
                                    ),
                                    p: ({ children, ...props }) => (
                                      <p className="text-xs font-light leading-relaxed" {...props}>{children}</p>
                                    )
                                  }}
                                >
                                  {hit.Description}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )}
                          <div>
                            <span className="text-sm font-semibold text-foreground">Secteur</span>
                            <p className="text-xs font-light mt-1" dangerouslySetInnerHTML={getHighlightedText(hit, 'Secteur')} />
                          </div>
                          {hit.Incertitude && (
                            <div>
                              <span className="text-sm font-semibold text-foreground">Incertitude</span>
                              <p className="text-sm font-light mt-1">{hit.Incertitude}</p>
                            </div>
                          )}
                          {hit.Contributeur && (
                            <div>
                              <span className="text-sm font-semibold text-foreground">Contributeur</span>
                              <div className="text-xs mt-1 text-break-words">
                                <ReactMarkdown 
                                  components={{
                                    a: ({ href, children, ...props }) => (
                                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline" {...props}>
                                        {children}
                                      </a>
                                    ),
                                    p: ({ children, ...props }) => (
                                      <p className="text-xs font-light leading-relaxed" {...props}>{children}</p>
                                    )
                                  }}
                                >
                                  {hit.Contributeur}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )}
                          {hit.Commentaires && (
                            <div>
                              <span className="text-sm font-semibold text-foreground">Commentaires</span>
                              <div className="text-xs mt-1 text-break-words">
                                <ReactMarkdown 
                                  components={{
                                    a: ({ href, children, ...props }) => (
                                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline" {...props}>
                                        {children}
                                      </a>
                                    ),
                                    p: ({ children, ...props }) => (
                                      <p className="text-xs font-light leading-relaxed" {...props}>{children}</p>
                                    )
                                  }}
                                >
                                  {hit.Commentaires}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {nbPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => paginationRefine(currentPage - 1)}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="w-4 h-4" />
            Précédent
          </Button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, nbPages) }, (_, i) => {
              const pageNumber = Math.max(0, Math.min(currentPage - 2 + i, nbPages - 1));
              return (
                <Button
                  key={pageNumber}
                  variant={pageNumber === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => paginationRefine(pageNumber)}
                  className="w-10"
                >
                  {pageNumber + 1}
                </Button>
              );
            })}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => paginationRefine(currentPage + 1)}
            disabled={currentPage >= nbPages - 1}
          >
            Suivant
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};