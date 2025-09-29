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
import { useLanguage } from '@/providers/LanguageProvider';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';

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
  const { t } = useTranslation('search');
  const { t: tResults } = useTranslation('search', { keyPrefix: 'results' });
  const { t: tFavoris } = useTranslation('search', { keyPrefix: 'favoris' });
  const tooltipMap = React.useMemo(() => ({
    blurredNotAddable: tResults('blurred_content_not_addable_to_favorites'),
    blurredNotSelectable: tResults('locked_content_not_selectable')
  }), [tResults]);
  const getTooltip = (key: keyof typeof tooltipMap) => tooltipMap[key];
  const { toast } = useToast();

  let language: 'fr' | 'en' = 'fr';
  try {
    const { language: currentLanguage } = useLanguage();
    language = currentLanguage;
  } catch (error) {
    console.warn('LanguageProvider not available, defaulting to French');
  }
  const currentLang: 'fr' | 'en' = language;
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
    const langSpecific = currentLang === 'fr'
      ? {
          Nom: ['Nom_fr', 'Nom'],
          Description: ['Description_fr', 'Description'],
          Commentaires: ['Commentaires_fr', 'Commentaires'],
          Secteur: ['Secteur_fr', 'Secteur'],
          'Sous-secteur': ['Sous-secteur_fr', 'Sous-secteur'],
          Périmètre: ['Périmètre_fr', 'Périmètre'],
          Localisation: ['Localisation_fr', 'Localisation'],
          Unite: ['Unite_fr', "Unité donnée d'activité"],
          Source: ['Source'],
        }
      : {
          Nom: ['Nom_en', 'Nom'],
          Description: ['Description_en', 'Description'],
          Commentaires: ['Commentaires_en', 'Commentaires'],
          Secteur: ['Secteur_en', 'Secteur'],
          'Sous-secteur': ['Sous-secteur_en', 'Sous-secteur'],
          Périmètre: ['Périmètre_en', 'Périmètre'],
          Localisation: ['Localisation_en', 'Localisation'],
          Unite: ['Unite_en', "Unité donnée d'activité"],
          Source: ['Source'],
        };

    const candidates = langSpecific[base as keyof typeof langSpecific] || [base];
    const highlight = (hit as any)._highlightResult || {};
    for (const attribute of candidates) {
      const highlighted = highlight[attribute];
      if (highlighted?.value) {
        return highlighted.value as string;
      }
      const raw = (hit as any)[attribute];
      if (raw) return String(raw);
    }
    return '';
  }, [currentLang]);

  const handleRemoveFavorite = useCallback(async (hit: AlgoliaHit) => {
    try {
      await removeFromFavorites(hit.objectID);
      toast({ title: tResults('favorites_removed') });
    } catch (error) {
      toast({ title: tResults('error_removing_favorite'), variant: 'destructive' });
      console.error('remove favorite error', error);
    }
  }, [removeFromFavorites, tResults, toast]);

  const getLocalizedValue = useCallback((hit: AlgoliaHit, frKey: string, enKey: string, fallback: string[] = []) => {
    const resolve = (key?: string) => (key ? (hit as any)[key] : undefined);
    const primaryKey = currentLang === 'fr' ? frKey : enKey;
    const primary = resolve(primaryKey);
    if (primary !== undefined && primary !== null && String(primary).trim() !== '') return String(primary);

    const secondary = currentLang === 'fr' ? resolve(enKey) : resolve(frKey);
    if (secondary !== undefined && secondary !== null && String(secondary).trim() !== '') return String(secondary);

    for (const f of fallback) {
      const raw = resolve(f);
      if (raw !== undefined && raw !== null && String(raw).trim() !== '') return String(raw);
    }
    return '';
  }, [currentLang]);

  const formatFE = (value?: number | string) => {
    if (value === undefined || value === null) return '';
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return '';
    return num.toLocaleString(currentLang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 4 });
  };

  const mapHitToEmissionFactor = useCallback((hit: AlgoliaHit): EmissionFactor => ({
    id: hit.objectID,
    nom: getLocalizedValue(hit, 'Nom_fr', 'Nom_en', ['Nom']),
    description: getLocalizedValue(hit, 'Description_fr', 'Description_en', ['Description']),
    fe: hit.FE ?? 0,
    uniteActivite: getLocalizedValue(hit, 'Unite_fr', 'Unite_en', ["Unité donnée d'activité"]),
    perimetre: getLocalizedValue(hit, 'Périmètre_fr', 'Périmètre_en', ['Périmètre']),
    source: hit.Source,
    localisation: getLocalizedValue(hit, 'Localisation_fr', 'Localisation_en', ['Localisation']),
    date: Number(hit.Date ?? 0),
    secteur: getLocalizedValue(hit, 'Secteur_fr', 'Secteur_en', ['Secteur']),
    sousSecteur: getLocalizedValue(hit, 'Sous-secteur_fr', 'Sous-secteur_en', ['Sous-secteur']),
    commentaires: getLocalizedValue(hit, 'Commentaires_fr', 'Commentaires_en', ['Commentaires']),
    incertitude: hit.Incertitude ?? '',
    contributeur: getLocalizedValue(hit, 'Contributeur', 'Contributeur_en'),
    contributeur_en: getLocalizedValue(hit, 'Contributeur_en', 'Contributeur_en'),
    methodologie: getLocalizedValue(hit, 'Méthodologie', 'Méthodologie_en'),
    methodologie_en: getLocalizedValue(hit, 'Méthodologie_en', 'Méthodologie_en'),
    typeDonnees: getLocalizedValue(hit, 'Type_de_données', 'Type_de_données_en'),
    typeDonnees_en: getLocalizedValue(hit, 'Type_de_données_en', 'Type_de_données_en'),
  }), [getLocalizedValue]);

  const handleExport = useCallback(() => {
    const selectedHits = hits.filter(hit => selectedItems.has(hit.objectID));
    const mappedHits = selectedHits.map(mapHitToEmissionFactor);

    if (mappedHits.length === 0) {
      toast({ title: tResults('no_selection'), description: tResults('select_at_least_one'), variant: 'destructive' });
      return;
    }

    onExport?.(mappedHits);
  }, [hits, mapHitToEmissionFactor, onExport, selectedItems, tResults, toast]);

  const handleCopyToClipboard = useCallback(() => {
    const selectedHits = hits.filter(hit => selectedItems.has(hit.objectID));
    const mappedHits = selectedHits.map(mapHitToEmissionFactor);

    if (mappedHits.length === 0) {
      toast({ title: tResults('no_selection'), description: tResults('select_at_least_one'), variant: 'destructive' });
      return;
    }

    onCopyToClipboard?.(mappedHits);
  }, [hits, mapHitToEmissionFactor, onCopyToClipboard, selectedItems, tResults, toast]);

  const handleRemoveSelected = useCallback(() => {
    if (!onRemoveSelectedFromFavorites) return;

    const selectedIds = Array.from(selectedItems);
    if (selectedIds.length === 0) {
      toast({ title: tResults('no_selection'), description: tResults('select_at_least_one'), variant: 'destructive' });
      return;
    }

    onRemoveSelectedFromFavorites(selectedIds);
  }, [onRemoveSelectedFromFavorites, selectedItems, tResults, toast]);

  const isPrivateHit = useCallback((hit: AlgoliaHit) => {
    return Boolean((hit as any).workspace_id) || (hit as any).import_type === 'imported';
  }, []);

  if (hits.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">
          {t('search:favoris.empty.no_match')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="text-sm text-foreground">
        {hits.length === 1 
          ? tFavoris('stats.favoritesDisplayed', { formattedCount: hits.length })
          : tFavoris('stats.favoritesDisplayed_plural', { formattedCount: hits.length })}
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
            {allSelected ? tResults('deselect_all') : tResults('select_all')} ({hits.length})
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
              {tResults('copy')} ({selectedItems.size})
            </Button>

            <RoleGuard requirePermission="canExport">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="flex w-full items-center justify-center gap-2 text-sm sm:w-auto"
              >
                <Download className="w-4 h-4" />
                {tResults('export')} ({selectedItems.size})
              </Button>
            </RoleGuard>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemoveSelected}
              className="flex w-full items-center justify-center gap-2 text-sm sm:w-auto"
              title={tResults('remove')}
            >
              <Trash2 className="w-4 h-4" />
              {tResults('remove')} ({selectedItems.size})
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
                      title={shouldBlur ? getTooltip('blurredNotSelectable') : ''}
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex flex-col items-start gap-1">
                          <div
                            className="text-lg font-semibold text-primary leading-tight"
                            dangerouslySetInnerHTML={{ __html: getHighlightedText(hit, 'Nom') }}
                          />
                          {isPrivateHit(hit) && (
                            <Badge variant="secondary" className="mt-1 text-[10px] leading-none px-2 py-0.5">
                              {tResults('imported_ef')}
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
                          <span className="text-sm font-semibold text-foreground">{tResults('emission_factor')}</span>
                          <PremiumBlur isBlurred={shouldBlur}>
                            <p className="text-2xl font-bold text-primary">
                              {hit.FE ? (typeof hit.FE === 'number' ? hit.FE : Number(hit.FE)).toLocaleString('fr-FR', { maximumFractionDigits: 4 }) : ''} kgCO₂eq
                            </p>
                          </PremiumBlur>
                          <div className="mt-2">
                            <span className="text-sm font-semibold text-foreground">{tResults('unit')}</span>
                            <PremiumBlur isBlurred={shouldBlur} showBadge={false}>
                              <p className="text-sm font-light">
                                {getLocalizedValue(hit, 'Unite_fr', 'Unite_en', ["Unité donnée d'activité"])}
                              </p>
                            </PremiumBlur>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                        {getLocalizedValue(hit, 'Périmètre_fr', 'Périmètre_en', ['Périmètre']) && (
                          <div>
                            <span className="text-sm font-semibold text-foreground">{tResults('perimeter')}</span>
                            <p className="text-sm font-light">
                              {getLocalizedValue(hit, 'Périmètre_fr', 'Périmètre_en', ['Périmètre'])}
                            </p>
                          </div>
                        )}
                          <div>
                            <span className="text-sm font-semibold text-foreground">{tResults('source')}</span>
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
                              <span className="text-sm font-semibold text-foreground">{tResults('imported_dataset')}</span>
                              <p className="text-sm font-light">{(hit as any).dataset_name}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {getLocalizedValue(hit, 'Localisation_fr', 'Localisation_en', ['Localisation']) && (
                          <Badge variant="secondary">{getLocalizedValue(hit, 'Localisation_fr', 'Localisation_en', ['Localisation'])}</Badge>
                        )}
                        {hit.Date && <Badge variant="outline">{hit.Date}</Badge>}
                        {getLocalizedValue(hit, 'Secteur_fr', 'Secteur_en', ['Secteur']) && (
                          <Badge variant="outline">{getLocalizedValue(hit, 'Secteur_fr', 'Secteur_en', ['Secteur'])}</Badge>
                        )}
                        {getLocalizedValue(hit, 'Sous-secteur_fr', 'Sous-secteur_en', ['Sous-secteur']) && (
                          <Badge variant="outline">{getLocalizedValue(hit, 'Sous-secteur_fr', 'Sous-secteur_en', ['Sous-secteur'])}</Badge>
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
                            <div className="text-xs font-light mt-1 text-muted-foreground">
                              <Highlight
                                hit={hit as any}
                                attribute={(currentLang === 'fr' ? 'Secteur_fr' : 'Secteur_en') as any}
                              />
                            </div>
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