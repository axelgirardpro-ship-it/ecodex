import React, { useCallback, useState } from 'react';
import { useHits, usePagination, Highlight } from 'react-instantsearch';
import { Copy, Download, Heart, Trash2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PremiumBlur } from '@/components/ui/PremiumBlur';
import { RoleGuard } from '@/components/ui/RoleGuard';
import { Checkbox } from '@/components/ui/checkbox';
import { useEmissionFactorAccess } from '@/hooks/useEmissionFactorAccess';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useSourceLogos } from '@/hooks/useSourceLogos';
import type { AlgoliaHit } from '@/types/algolia';
import { EmissionFactor } from '@/types/emission-factor';
import { toast } from 'sonner';

interface FavorisSearchResultsProps {
  selectedItems: Set<string>;
  onItemSelect: (itemId: string) => void;
  onSelectAll: (ids: string[], selected: boolean) => void;
  onExport?: (items: EmissionFactor[]) => void;
  onCopyToClipboard?: (items: EmissionFactor[]) => void;
  onRemoveSelectedFromFavorites?: (itemIds: string[]) => void;
}

export const FavorisSearchResults: React.FC<FavorisSearchResultsProps> = ({
  selectedItems,
  onItemSelect,
  onSelectAll,
  onExport,
  onCopyToClipboard,
  onRemoveSelectedFromFavorites,
}) => {
  const { hits: originalHits } = useHits<AlgoliaHit>();
  const { currentRefinement: currentPage, nbPages, refine: paginationRefine } = usePagination();
  const { removeFromFavorites } = useFavorites();
  const { getSourceLogo } = useSourceLogos();
  const { shouldBlurPremiumContent } = useEmissionFactorAccess();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const currentLang: 'fr' | 'en' = 'fr';
  const hits = originalHits;

  const allSelected = hits.length > 0 && hits.every(hit => selectedItems.has(hit.objectID));

  const handleSelectAllChange = useCallback(
    (checked: boolean | 'indeterminate') => {
      const shouldSelect = checked === true;
      const hitIds = hits.map(hit => hit.objectID);
      onSelectAll(hitIds, shouldSelect);
    },
    [hits, onSelectAll]
  );

  const toggleRowExpansion = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const getHighlightedText = useCallback((hit: AlgoliaHit, base: string) => {
    const candidates: string[] = (() => {
      switch (base) {
        case 'Nom':
          return ['Nom_fr', 'Nom_en', 'Nom'];
        case 'Description':
          return ['Description_fr', 'Description_en', 'Description'];
        case 'Commentaires':
          return ['Commentaires_fr', 'Commentaires_en', 'Commentaires'];
        case 'Secteur':
          return ['Secteur_fr', 'Secteur_en', 'Secteur'];
        case 'Sous-secteur':
          return ['Sous-secteur_fr', 'Sous-secteur_en', 'Sous-secteur'];
        case 'Périmètre':
          return ['Périmètre_fr', 'Périmètre_en', 'Périmètre'];
        case 'Localisation':
          return ['Localisation_fr', 'Localisation_en', 'Localisation'];
        case 'Unite':
          return ['Unite_fr', 'Unite_en', "Unité donnée d'activité"];
        case 'Source':
          return ['Source'];
        default:
          return [base];
      }
    })();

    const highlight = (hit as any)._highlightResult || {};
    for (const attribute of candidates) {
      const highlighted = highlight[attribute];
      if (highlighted?.value) return highlighted.value as string;
      const raw = (hit as any)[attribute];
      if (raw) return raw as string;
    }

    return '';
  }, []);

  const handleRemoveFavorite = useCallback(async (hit: AlgoliaHit) => {
    try {
      await removeFromFavorites(hit.objectID);
      toast.success('Retiré des favoris');
    } catch (error) {
      toast.error('Erreur lors de la suppression du favori');
      console.error('remove favorite error', error);
    }
  }, [removeFromFavorites]);

  const mapHitToEmissionFactor = useCallback((hit: AlgoliaHit): EmissionFactor => ({
    id: hit.objectID,
    nom: (hit as any).Nom_fr || (hit as any).Nom_en || (hit as any).Nom || '',
    description: (hit as any).Description_fr || (hit as any).Description_en || (hit as any).Description || '',
    fe: hit.FE,
    uniteActivite: (hit as any).Unite_fr || (hit as any).Unite_en || (hit as any)['Unité donnée d\'activité'] || '',
    source: hit.Source,
    secteur: (hit as any).Secteur_fr || (hit as any).Secteur_en || (hit as any).Secteur || '',
    sousSecteur: (hit as any)['Sous-secteur_fr'] || (hit as any)['Sous-secteur_en'] || (hit as any)['Sous-secteur'] || '',
    localisation: (hit as any).Localisation_fr || (hit as any).Localisation_en || (hit as any).Localisation || '',
    date: hit.Date,
    incertitude: hit.Incertitude,
    perimetre: (hit as any)['Périmètre_fr'] || (hit as any)['Périmètre_en'] || (hit as any)['Périmètre'] || '',
    contributeur: (hit as any).Contributeur || '',
    contributeur_en: (hit as any).Contributeur_en || '',
    methodologie: (hit as any).Méthodologie || '',
    methodologie_en: (hit as any).Méthodologie_en || '',
    typeDonnees: (hit as any)['Type_de_données'] || '',
    typeDonnees_en: (hit as any)['Type_de_données_en'] || '',
    commentaires: (hit as any).Commentaires_fr || (hit as any).Commentaires_en || (hit as any).Commentaires || '',
  }), []);

  const handleExport = useCallback(() => {
    const selectedHits = hits.filter(hit => selectedItems.has(hit.objectID));
    const mappedHits = selectedHits.map(mapHitToEmissionFactor);

    if (mappedHits.length === 0) {
      toast.error('Aucun favori sélectionné');
      return;
    }

    onExport?.(mappedHits);
  }, [hits, mapHitToEmissionFactor, onExport, selectedItems]);

  const handleCopyToClipboard = useCallback(() => {
    const selectedHits = hits.filter(hit => selectedItems.has(hit.objectID));
    const mappedHits = selectedHits.map(mapHitToEmissionFactor);

    if (mappedHits.length === 0) {
      toast.error('Aucun favori sélectionné');
      return;
    }

    onCopyToClipboard?.(mappedHits);
  }, [hits, mapHitToEmissionFactor, onCopyToClipboard, selectedItems]);

  const handleRemoveSelected = useCallback(() => {
    if (!onRemoveSelectedFromFavorites) return;

    const selectedIds = Array.from(selectedItems);
    if (selectedIds.length === 0) {
      toast.error('Aucun favori sélectionné');
      return;
    }

    onRemoveSelectedFromFavorites(selectedIds);
  }, [onRemoveSelectedFromFavorites, selectedItems]);

  const isPrivateHit = useCallback((hit: AlgoliaHit) => {
    return Boolean((hit as any).workspace_id) || (hit as any).import_type === 'imported';
  }, []);

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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="text-sm text-foreground">
          {hits.length} favori{hits.length > 1 ? 's' : ''} affiché{hits.length > 1 ? 's' : ''}
        </div>
      </div>

      <div className="flex w-full flex-col items-start gap-4 md:flex-row md:items-center md:justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex flex-wrap items-center gap-3">
          <Checkbox
            id="select-all"
            checked={allSelected}
            onCheckedChange={handleSelectAllChange}
          />
          <label htmlFor="select-all" className="text-sm cursor-pointer">
            {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'} ({hits.length})
          </label>
        </div>

        {selectedItems.size > 0 && (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyToClipboard}
              className="flex w-full items-center justify-center gap-2 text-sm sm:w-auto"
            >
              <Copy className="w-4 h-4" />
              Copier ({selectedItems.size})
            </Button>

            <RoleGuard requirePermission="canExport">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="flex w-full items-center justify-center gap-2 text-sm sm:w-auto"
              >
                <Download className="w-4 h-4" />
                Exporter ({selectedItems.size})
              </Button>
            </RoleGuard>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemoveSelected}
              className="flex w-full items-center justify-center gap-2 text-sm sm:w-auto"
            >
              <Trash2 className="w-4 h-4" />
              Retirer ({selectedItems.size})
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {hits.map((hit) => {
          const isExpanded = expandedRows.has(hit.objectID);
          const shouldBlur = shouldBlurPremiumContent(hit.Source);

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
                          <h3 className="text-lg font-semibold text-primary leading-tight">
                            {(() => {
                              const attribute = (hit as any).Nom_fr !== undefined
                                ? 'Nom_fr'
                                : ((hit as any).Nom_en !== undefined ? 'Nom_en' : 'Nom');
                              return <Highlight hit={hit as any} attribute={attribute as any} />;
                            })()}
                          </h3>
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
                              handleRemoveFavorite(hit);
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
                          <PremiumBlur isBlurred={shouldBlur}>
                            <p className="text-2xl font-bold text-primary">
                              {hit.FE ? (typeof hit.FE === 'number' ? hit.FE : Number(hit.FE)).toLocaleString('fr-FR', { maximumFractionDigits: 4 }) : ''} kgCO₂eq
                            </p>
                          </PremiumBlur>
                          <div className="mt-2">
                            <span className="text-sm font-semibold text-foreground">Unité</span>
                            <PremiumBlur isBlurred={shouldBlur} showBadge={false}>
                              <p className="text-sm font-light">
                                {(hit as any).Unite_fr || (hit as any).Unite_en || ''}
                              </p>
                            </PremiumBlur>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {((hit as any)['Périmètre_fr'] || (hit as any)['Périmètre_en'] || (hit as any)['Périmètre']) && (
                            <div>
                              <span className="text-sm font-semibold text-foreground">Périmètre</span>
                              <p className="text-sm font-light">
                                {(hit as any)['Périmètre_fr'] || (hit as any)['Périmètre_en'] || (hit as any)['Périmètre']}
                              </p>
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
                              <p className="text-sm font-light">
                                {hit.Source}
                              </p>
                            </div>
                          </div>
                          {(hit as any).dataset_name && (
                            <div>
                              <span className="text-sm font-semibold text-foreground">Dataset importé</span>
                              <p className="text-sm font-light">{(hit as any).dataset_name}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {((hit as any)['Localisation_fr'] || (hit as any)['Localisation_en'] || (hit as any)['Localisation']) && (
                          <Badge variant="secondary">{(hit as any)['Localisation_fr'] || (hit as any)['Localisation_en'] || (hit as any)['Localisation']}</Badge>
                        )}
                        {hit.Date && <Badge variant="outline">{hit.Date}</Badge>}
                        {((hit as any)['Secteur_fr'] || (hit as any)['Secteur_en'] || (hit as any)['Secteur']) && (
                          <Badge variant="outline">{(hit as any)['Secteur_fr'] || (hit as any)['Secteur_en'] || (hit as any)['Secteur']}</Badge>
                        )}
                        {((hit as any)['Sous-secteur_fr'] || (hit as any)['Sous-secteur_en'] || (hit as any)['Sous-secteur']) && (
                          <Badge variant="outline">{(hit as any)['Sous-secteur_fr'] || (hit as any)['Sous-secteur_en'] || (hit as any)['Sous-secteur']}</Badge>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t space-y-3">
                          {(hit as any).Description_fr || (hit as any).Description_en ? (
                            <div>
                              <span className="text-sm font-semibold text-foreground">Description</span>
                              <div className="text-xs mt-1 text-break-words">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    a: ({ href, children, ...props }) => (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 underline"
                                        {...props}
                                      >
                                        {children}
                                      </a>
                                    ),
                                    p: ({ children, ...props }) => (
                                      <p className="text-xs font-light leading-relaxed" {...props}>
                                        {children}
                                      </p>
                                    ),
                                  }}
                                >
                                  {((hit as any).Description_fr || (hit as any).Description_en) as string}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ) : null}
                          <div>
                            <span className="text-sm font-semibold text-foreground">Secteur</span>
                            <p className="text-xs font-light mt-1">
                              {(() => {
                                const attribute = (hit as any).Secteur_fr !== undefined
                                  ? 'Secteur_fr'
                                  : ((hit as any).Secteur_en !== undefined ? 'Secteur_en' : 'Secteur');
                                return <Highlight hit={hit as any} attribute={attribute as any} />;
                              })()}
                            </p>
                          </div>
                          {hit.Incertitude && (
                            <div>
                              <span className="text-sm font-semibold text-foreground">Incertitude</span>
                              <p className="text-sm font-light mt-1">{hit.Incertitude}</p>
                            </div>
                          )}
                          {((hit as any).Contributeur || (hit as any).Contributeur_en) && (
                            <div>
                              <span className="text-sm font-semibold text-foreground">
                                {currentLang === 'fr' ? 'Contributeur' : 'Contributor'}
                              </span>
                              <div className="text-xs mt-1 text-break-words">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    a: ({ href, children, ...props }) => (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 underline"
                                        {...props}
                                      >
                                        {children}
                                      </a>
                                    ),
                                    p: ({ children, ...props }) => (
                                      <p className="text-xs font-light leading-relaxed" {...props}>
                                        {children}
                                      </p>
                                    ),
                                  }}
                                >
                                  {(currentLang === 'fr' ? (hit as any).Contributeur : (hit as any).Contributeur_en) as string}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )}
                          {((hit as any).Méthodologie || (hit as any).Méthodologie_en) && (
                            <div>
                              <span className="text-sm font-semibold text-foreground">
                                {currentLang === 'fr' ? 'Méthodologie' : 'Methodology'}
                              </span>
                              <p className="text-xs font-light mt-1">
                                {currentLang === 'fr' ? (hit as any).Méthodologie : (hit as any).Méthodologie_en}
                              </p>
                            </div>
                          )}
                          {((hit as any)['Type_de_données'] || (hit as any)['Type_de_données_en']) && (
                            <div>
                              <span className="text-sm font-semibold text-foreground">
                                {currentLang === 'fr' ? 'Type de données' : 'Data Type'}
                              </span>
                              <p className="text-xs font-light mt-1">
                                {currentLang === 'fr' ? (hit as any)['Type_de_données'] : (hit as any)['Type_de_données_en']}
                              </p>
                            </div>
                          )}
                          {(hit as any).Commentaires_fr || (hit as any).Commentaires_en ? (
                            <div>
                              <span className="text-sm font-semibold text-foreground">Commentaires</span>
                              <div className="text-xs mt-1 text-break-words">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    a: ({ href, children, ...props }) => (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 underline"
                                        {...props}
                                      >
                                        {children}
                                      </a>
                                    ),
                                    p: ({ children, ...props }) => (
                                      <p className="text-xs font-light leading-relaxed" {...props}>
                                        {children}
                                      </p>
                                    ),
                                  }}
                                >
                                  {((hit as any).Commentaires_fr || (hit as any).Commentaires_en) as string}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ) : null}
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

      {nbPages > 1 && (() => {
        const maxVisible = 5;
        let start = Math.max(0, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(nbPages - 1, start + maxVisible - 1);
        if (end - start < maxVisible - 1) {
          start = Math.max(0, end - maxVisible + 1);
        }
        const pages: number[] = [];
        for (let p = start; p <= end; p++) pages.push(p);

        return (
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
              {start > 0 && (
                <Button
                  key="first-page"
                  variant={0 === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => paginationRefine(0)}
                  className="w-10"
                >
                  1
                </Button>
              )}
              {start > 1 && <span key="left-ellipsis" className="px-2">...</span>}

              {pages.map((p) => (
                <Button
                  key={`page-${p}`}
                  variant={p === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => paginationRefine(p)}
                  className="w-10"
                >
                  {p + 1}
                </Button>
              ))}

              {end < nbPages - 2 && <span key="right-ellipsis" className="px-2">...</span>}
              {end < nbPages - 1 && (
                <Button
                  key="last-page"
                  variant={nbPages - 1 === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => paginationRefine(nbPages - 1)}
                  className="w-10"
                >
                  {nbPages}
                </Button>
              )}
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
        );
      })()}
    </div>
  );
};