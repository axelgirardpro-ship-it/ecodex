import React from 'react';
import { useHits, usePagination, useSearchBox, Highlight as AlgoliaHighlight } from 'react-instantsearch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
 
import { Checkbox } from '@/components/ui/checkbox';
import { Heart, Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, Lock, Copy, MessageSquare, Sparkles, LayoutList, Table2 } from 'lucide-react';
import { useFavorites } from '@/contexts/FavoritesContext';
import { PaidBlur } from '@/components/ui/PaidBlur';
import { useEmissionFactorAccess } from '@/hooks/useEmissionFactorAccess';
import { useToast } from '@/hooks/use-toast';
import { useQuotaActions } from '@/hooks/useQuotaActions';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useSourceLogos } from '@/hooks/useSourceLogos';
import { useSafeLanguage } from '@/hooks/useSafeLanguage';
import { useTranslation } from 'react-i18next';
import { LlamaCloudChatModal } from '@/components/search/LlamaCloudChatModal';

interface AlgoliaHit {
  objectID: string;
  Source: string;
  Date?: number;
  FE?: number;
  Incertitude?: string;
  Contributeur?: string;
  Contributeur_en?: string;
  Méthodologie?: string;
  Méthodologie_en?: string;
  'Type_de_données'?: string;
  'Type_de_données_en'?: string;
  scope?: 'public'|'private';
  workspace_id?: string | null;
  languages?: string[];
  Nom_fr?: string; Nom_en?: string;
  Description_fr?: string; Description_en?: string;
  Commentaires_fr?: string; Commentaires_en?: string;
  Secteur_fr?: string; Secteur_en?: string;
  'Sous-secteur_fr'?: string; 'Sous-secteur_en'?: string;
  'Périmètre_fr'?: string; 'Périmètre_en'?: string;
  Localisation_fr?: string; Localisation_en?: string;
  Unite_fr?: string; Unite_en?: string;
  _highlightResult?: Record<string, { value?: string }>;
}

// Suppression du sélecteur "Résultats par page"

 

const PaginationComponent: React.FC = () => {
  const { currentRefinement, nbPages, refine, isFirstPage, isLastPage } = usePagination();

  if (nbPages <= 1) return null;

  const pages = [];
  const maxVisiblePages = 5;
  let startPage = Math.max(0, currentRefinement - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(nbPages - 1, startPage + maxVisiblePages - 1);

  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(0, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex justify-center items-center gap-2 mt-6">
      <Button
        variant="outline"
        size="sm"
        onClick={() => refine(currentRefinement - 1)}
        disabled={isFirstPage}
      >
        <ChevronLeft className="h-4 w-4" />
        Précédent
      </Button>

      {startPage > 0 && (
        <>
          <Button
            key="first-page"
            variant={0 === currentRefinement ? "default" : "outline"}
            size="sm"
            onClick={() => refine(0)}
          >
            1
          </Button>
          {startPage > 1 && <span key="left-ellipsis" className="px-2">...</span>}
        </>
      )}

      {pages.map((page) => (
        <Button
          key={`page-${page}`}
          variant={page === currentRefinement ? "default" : "outline"}
          size="sm"
          onClick={() => refine(page)}
        >
          {page + 1}
        </Button>
      ))}

      {endPage < nbPages - 1 && (
        <>
          {endPage < nbPages - 2 && <span key="right-ellipsis" className="px-2">...</span>}
          <Button
            key="last-page"
            variant={nbPages - 1 === currentRefinement ? "default" : "outline"}
            size="sm"
            onClick={() => refine(nbPages - 1)}
          >
            {nbPages}
          </Button>
        </>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => refine(currentRefinement + 1)}
        disabled={isLastPage}
      >
        Suivant
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

const StateResults: React.FC = () => {
  const { query } = useSearchBox();
  const { hits } = useHits<AlgoliaHit>();
  const trimmed = (query || '').trim();
  const language = useSafeLanguage();
  const { t } = useTranslation('search', { keyPrefix: 'results' });

  if (hits.length === 0 && trimmed.length > 0 && trimmed.length < 3) {
    return (
      <div className="text-center py-12">
        <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">{t('no_results_short_query_title')}</h3>
        <p className="text-muted-foreground">
          {t('no_results_short_query_description')}
        </p>
      </div>
    );
  }

  if (hits.length === 0 && trimmed.length === 0) {
    return (
      <div className="text-center py-12">
        <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">{t('no_results_empty_query_title')}</h3>
        <p className="text-muted-foreground">
          {t('no_results_empty_query_description')}
        </p>
      </div>
    );
  }

  if (hits.length === 0 && trimmed.length >= 3) {
    return (
      <div className="text-center py-12">
        <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">{t('no_results_found_title')}</h3>
        <p className="text-muted-foreground mb-4">
          {t('no_results_found_description', { query })}
        </p>
        <div className="text-sm text-muted-foreground">
          <p>{t('suggestions_title')}</p>
          <ul className="mt-2 space-y-1">
            <li>• {t('suggestion_1')}</li>
            <li>• {t('suggestion_2')}</li>
            <li>• {t('suggestion_3')}</li>
          </ul>
        </div>
      </div>
    );
  }

  return null;
};

export const SearchResults: React.FC = () => {
  const { hits: originalHits } = useHits<AlgoliaHit>();
  const { query } = useSearchBox();
  const language = useSafeLanguage();
  const { t } = useTranslation('search', { keyPrefix: 'results' });
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = React.useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = React.useState<'detailed' | 'table'>('detailed');
  const [chatConfig, setChatConfig] = React.useState<{
    isOpen: boolean;
    source: string;
    productName: string;
  } | null>(null);
  
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const { hasAccess, shouldBlurPaidContent, canUseFavorites } = useEmissionFactorAccess();
  const { toast } = useToast();
  const { getSourceLogo } = useSourceLogos();
  const { handleExport: quotaHandleExport, handleCopyToClipboard: quotaHandleCopyToClipboard } = useQuotaActions();

  const currentLang: 'fr' | 'en' = language;

  const getLocalizedValue = (hit: AlgoliaHit, frKey: string, enKey: string, fallbackKeys: string[] = []) => {
    const resolve = (key?: string) => (key ? hit[key] : undefined);
    const primaryKey = currentLang === 'fr' ? frKey : enKey;
    const primary = resolve(primaryKey);
    if (primary !== undefined && primary !== null && String(primary).trim() !== '') return String(primary);

    const secondary = currentLang === 'fr' ? resolve(enKey) : resolve(frKey);
    if (secondary !== undefined && secondary !== null && String(secondary).trim() !== '') return String(secondary);

    for (const key of fallbackKeys) {
      const val = resolve(key);
      if (val !== undefined && val !== null && String(val).trim() !== '') return String(val);
    }
    return '';
  };

  const formatFE = (value?: number | string) => {
    if (value === undefined || value === null) return '';
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return '';
    const decimals = Math.abs(num) >= 1 ? 1 : 4;
    return num.toLocaleString(currentLang === 'fr' ? 'fr-FR' : 'en-US', { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    });
  };

  const renderTextField = (label: string, value?: string | number) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    if (!text) return null;
    return (
      <div>
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <p className="mt-1 text-xs font-light text-muted-foreground">{text}</p>
      </div>
    );
  };

  const renderMarkdownField = (label: string, value?: string) => {
    if (!value || !value.trim()) return null;
    return (
      <div>
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <div className="mt-1 text-xs font-light text-muted-foreground">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
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
              strong: ({ children, ...props }) => (
                <strong className="font-bold" {...props}>{children}</strong>
              ),
              em: ({ children, ...props }) => (
                <em className="italic" {...props}>{children}</em>
              ),
              mark: ({ children, ...props }) => (
                <mark className="bg-yellow-200 px-1 rounded" {...props}>{children}</mark>
              )
            }}
          >
            {value}
          </ReactMarkdown>
        </div>
      </div>
    );
  };

  // Aucun tri/filtrage client: on se base uniquement sur l'ordre/les filtres Algolia
  const hits = originalHits;

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getHighlightedText = (hit: AlgoliaHit, base: string) => {
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
          Incertitude: ['Incertitude'],
          Contributeur: ['Contributeur'],
          Méthodologie: ['Méthodologie'],
          'Type de données': ['Type_de_données'],
        }
      : {
          Nom: ['Nom_en', 'Nom', 'Nom_fr'],
          Description: ['Description_en', 'Description', 'Description_fr'],
          Commentaires: ['Commentaires_en', 'Commentaires', 'Commentaires_fr'],
          Secteur: ['Secteur_en', 'Secteur', 'Secteur_fr'],
          'Sous-secteur': ['Sous-secteur_en', 'Sous-secteur', 'Sous-secteur_fr'],
          Périmètre: ['Périmètre_en', 'Périmètre', 'Périmètre_fr'],
          Localisation: ['Localisation_en', 'Localisation', 'Localisation_fr'],
          Unite: ['Unite_en', "Unité donnée d'activité", 'Unite_fr'],
          Source: ['Source'],
          Incertitude: ['Incertitude'],
          Contributeur: ['Contributeur_en', 'Contributeur'],
          Méthodologie: ['Méthodologie_en', 'Méthodologie'],
          'Type de données': ['Type_de_données_en', 'Type_de_données'],
        };

    const candidates = langSpecific[base as keyof typeof langSpecific] || [base];
    const hl = hit._highlightResult || {};
    
    // Essayer d'utiliser _highlightResult d'Algolia
    for (const a of candidates) {
      const h = hl[a];
      if (h?.value) {
        const text = String(h.value)
          .replace(/&lt;em&gt;|&amp;lt;em&amp;gt;/g, '<em>')
          .replace(/&lt;\/em&gt;|&amp;lt;\/em&amp;gt;/g, '</em>');
        return { __html: text };
      }
    }
    
    // Fallback: si pas de _highlightResult, chercher la valeur brute et faire le highlight manuellement
    const searchTerm = (query || '').trim().toLowerCase();
    
    for (const a of candidates) {
      const v = hit[a];
      if (v) {
        const text = String(v);
        // Highlight manuel si on a une query
        if (searchTerm && searchTerm.length >= 3) {
          const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(${escapedTerm})`, 'gi');
          const highlighted = text.replace(regex, '<em>$1</em>');
          return { __html: highlighted };
        }
        return { __html: text };
      }
    }
    return { __html: '' };
  };

  // Helper: déterminer si un hit est flouté (supporte le flag proxy is_blurred et le fallback UI)
  const isHitBlurred = (hit: AlgoliaHit) => {
    return (hit.is_blurred === true) || shouldBlurPaidContent(hit.Source);
  };

  const handleItemSelect = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const tooltipMap = React.useMemo(() => ({
    premiumOnly: t('feature_pro_favorites'),
    blurredNotAddable: t('blurred_content_not_addable_to_favorites'),
    blurredNotSelectable: t('locked_content_not_selectable')
  }), [t]);

  const getTooltip = (key: keyof typeof tooltipMap): string => tooltipMap[key];

  const handleSelectAll = () => {
    const nonBlurredIds = hits.filter(h => !isHitBlurred(h)).map(h => h.objectID);
    if (selectedItems.size === nonBlurredIds.length && nonBlurredIds.length > 0) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(nonBlurredIds));
      if (nonBlurredIds.length === 0) {
        toast({ title: t('no_selection'), description: t('locked_content_not_selectable') });
      }
    }
  };

  const handleCopyToClipboard = async () => {
    if (selectedItems.size === 0) {
      toast({
        title: t('no_selection'),
        description: t('select_at_least_one'),
        variant: "destructive",
      });
      return;
    }

    const selectedResults = hits.filter(hit => selectedItems.has(hit.objectID));
    const allowed = selectedResults.filter(h => !isHitBlurred(h));
    if (allowed.length === 0) {
      toast({ title: t('locked_content_not_selectable'), description: t('locked_content_not_copyable') });
      return;
    }
    const success = await quotaHandleCopyToClipboard(allowed);
    if (success) {
      setSelectedItems(new Set());
    }
  };

  const handleExport = async () => {
    if (selectedItems.size === 0) {
      toast({
        title: t('no_selection'),
        description: t('select_at_least_one'),
        variant: "destructive",
      });
      return;
    }

    const selectedResults = hits.filter(hit => selectedItems.has(hit.objectID));
    const allowed = selectedResults.filter(h => !isHitBlurred(h));
    if (allowed.length === 0) {
      toast({ title: t('locked_content_not_selectable'), description: t('locked_content_not_exportable') });
      return;
    }
    const success = await quotaHandleExport(allowed, 'facteurs_emissions_recherche');
    if (success) {
      setSelectedItems(new Set());
    }
  };

  const mapHitToEmissionFactor = (hit: AlgoliaHit) => ({
    id: hit.objectID,
    nom: getLocalizedValue(hit, 'Nom_fr', 'Nom_en', ['Nom']),
    description: getLocalizedValue(hit, 'Description_fr', 'Description_en', ['Description']),
    fe: hit.FE,
    uniteActivite: getLocalizedValue(hit, 'Unite_fr', 'Unite_en', ["Unité donnée d'activité"]),
    source: hit.Source,
    secteur: getLocalizedValue(hit, 'Secteur_fr', 'Secteur_en', ['Secteur']),
    sousSecteur: getLocalizedValue(hit, 'Sous-secteur_fr', 'Sous-secteur_en', ['Sous-secteur']),
    localisation: getLocalizedValue(hit, 'Localisation_fr', 'Localisation_en', ['Localisation']),
    date: hit.Date,
    incertitude: hit.Incertitude,
    perimetre: getLocalizedValue(hit, 'Périmètre_fr', 'Périmètre_en', ['Périmètre']),
    contributeur: getLocalizedValue(hit, 'Contributeur', 'Contributeur_en'),
    methodologie: getLocalizedValue(hit, 'Méthodologie', 'Méthodologie_en'),
    typeDonnees: getLocalizedValue(hit, 'Type_de_données', 'Type_de_données_en'),
    commentaires: getLocalizedValue(hit, 'Commentaires_fr', 'Commentaires_en', ['Commentaires'])
  });

  const handleFavoriteToggle = async (hit: AlgoliaHit) => {
    const emissionFactor = mapHitToEmissionFactor(hit);
    if (isHitBlurred(hit)) {
      toast({ title: t('locked_content_not_addable_to_favorites'), description: t('blurred_content_not_addable_to_favorites') });
      return;
    }
    if (isFavorite(hit.objectID)) {
      await removeFromFavorites(hit.objectID);
    } else {
      await addToFavorites(emissionFactor);
    }
  };

  const handleAddSelectedToFavorites = async () => {
    if (!canUseFavorites()) {
      toast({
        title: t('feature_pro_favorites'),
        description: t('feature_pro_favorites'),
      });
      return;
    }

    const selectedHits = hits.filter((h) => selectedItems.has(h.objectID));
    const toAdd = selectedHits.filter((h) => !isFavorite(h.objectID));
    const allowed = toAdd.filter(h => !isHitBlurred(h));

    if (toAdd.length === 0) {
      toast({
        title: t('already_in_favorites'),
        description: t('already_in_favorites'),
      });
      return;
    }

    if (allowed.length === 0) {
      toast({ title: t('locked_content_not_addable_to_favorites'), description: t('blurred_content_not_addable_to_favorites') });
      return;
    }
    await Promise.all(allowed.map((h) => addToFavorites(mapHitToEmissionFactor(h))));

    toast({
      title: t('favorites_updated'),
      description: t('favorites_added', { count: allowed.length }),
    });
  };
  return (
    <div className="space-y-6">
      <StateResults />
      
      {hits.length > 0 && (
        <>
          {/* Header avec sélection et export */}
          <div className="flex w-full flex-col items-start gap-4 md:flex-row md:items-center md:justify-between mb-6 p-4 bg-white rounded-lg border border-border">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedItems.size === hits.length && hits.length > 0}
                  onCheckedChange={handleSelectAll}
                  className="border-indigo-950 data-[state=checked]:bg-indigo-950 data-[state=checked]:border-indigo-950"
                />
                <span className="text-sm font-medium font-montserrat text-indigo-950">
                  {selectedItems.size === hits.length && hits.length > 0 ? t('deselect_all') : t('select_all')}
                </span>
              </div>
              {selectedItems.size > 0 && (
                <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
                  {t('selected_items', { count: selectedItems.size })}
                </Badge>
              )}
            </div>
            {selectedItems.size > 0 && (
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
                <Button
                  onClick={handleCopyToClipboard}
                  variant="outline"
                  size="sm"
                  className="flex w-full items-center justify-center gap-2 font-montserrat text-sm sm:w-auto"
                >
                  <Copy className="h-4 w-4" />
                  {t('copy')} ({selectedItems.size})
                </Button>
                <Button
                  onClick={handleAddSelectedToFavorites}
                  size="sm"
                  className="flex w-full items-center justify-center gap-2 font-montserrat text-sm sm:w-auto"
                  disabled={!canUseFavorites()}
                  title={!canUseFavorites() ? getTooltip('premiumOnly') : ''}
                >
                  <Heart className="h-4 w-4" />
                  {t('add_to_favorites')} ({selectedItems.size})
                </Button>
                <Button
                  onClick={handleExport}
                  size="sm"
                  className="flex w-full items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 text-white font-montserrat text-sm sm:w-auto"
                >
                  <Download className="h-4 w-4" />
                  {t('export')} ({selectedItems.size})
                </Button>
              </div>
            )}
          </div>

          {/* Header avec pagination */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              {/* View Switcher */}
              <div className="flex items-center gap-1 border border-border rounded-lg p-1">
                <Button
                  variant={viewMode === 'detailed' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('detailed')}
                  className="h-8 px-3"
                  title={t('view_detailed')}
                >
                  <LayoutList className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">{t('view_detailed')}</span>
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="h-8 px-3"
                  title={t('view_table')}
                >
                  <Table2 className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">{t('view_table')}</span>
                </Button>
              </div>

              <div className="text-sm text-indigo-950 font-montserrat">
                {t('displayed_results', { count: hits.length })}
              </div>
            </div>
          </div>

          {/* Results */}
          {viewMode === 'detailed' ? (
            <div className="space-y-4">
              {hits.map((hit) => {
              const isExpanded = expandedRows.has(hit.objectID);
              const isFav = isFavorite(hit.objectID);
              const shouldBlur = isHitBlurred(hit);
              const isPrivateHit = Boolean(hit.workspace_id) || hit.import_type === 'imported';

              return (
                <Card key={hit.objectID} className="relative overflow-hidden bg-white border border-border hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-start gap-3 flex-1">
                         <Checkbox
                           checked={selectedItems.has(hit.objectID)}
                           onCheckedChange={() => handleItemSelect(hit.objectID)}
                           onClick={(e) => e.stopPropagation()}
                           disabled={shouldBlur}
                          title={shouldBlur ? getTooltip('blurredNotSelectable') : ''}
                           className="mt-1 cursor-pointer border-indigo-950 data-[state=checked]:bg-indigo-950 data-[state=checked]:border-indigo-950"
                         />
                        <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex flex-col items-start gap-1">
                            <h3 className="text-lg font-semibold text-primary leading-tight font-montserrat">
                              {/* Highlight natif Algolia - le backend transmet attributesToHighlight */}
                              <AlgoliaHighlight attribute={currentLang === 'fr' ? 'Nom_fr' : 'Nom_en'} hit={hit} />
                            </h3>
                            {isPrivateHit && (
                              <Badge variant="secondary" className="mt-1 text-[10px] leading-none px-2 py-0.5">
                                {t('imported_ef')}
                              </Badge>
                            )}
                          </div>
                           <div className="flex items-center gap-2 ml-4">
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={(e) => {
                                 e.stopPropagation();
                                  toggleRowExpansion(hit.objectID);
                                }}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <span className="text-sm font-medium mr-2">
                                  {isExpanded ? t('hide_details') : t('show_details')}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (canUseFavorites() && !shouldBlur) handleFavoriteToggle(hit);
                              }}
                              disabled={!canUseFavorites() || shouldBlur}
                              className={`${isFav ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-foreground'} ${(!canUseFavorites() || shouldBlur) ? 'opacity-50 cursor-not-allowed' : ''}`}
                               title={!canUseFavorites()
                                 ? getTooltip('premiumOnly')
                                 : (shouldBlur ? getTooltip('blurredNotAddable') : '')}
                            >
                              {!canUseFavorites() ? (
                                <Lock className="h-4 w-4" />
                              ) : (
                                <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
                              )}
                            </Button>
                          </div>
                        </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-3">
                          <div>
                              <span className="text-sm font-semibold text-foreground">{t('emission_factor')}</span>
                            <PaidBlur isBlurred={shouldBlur} showBadge>
                                <p className="text-2xl font-bold text-primary font-montserrat">{formatFE(hit.FE)} kgCO₂eq</p>
                            </PaidBlur>
                            <div className="mt-2">
                                <span className="text-sm font-semibold text-foreground">{t('unit')}</span>
                                  <p className="text-sm font-light">
                                    {getLocalizedValue(hit, 'Unite_fr', 'Unite_en', ["Unité donnée d'activité"])}
                                  </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                              {getLocalizedValue(hit, 'Périmètre_fr', 'Périmètre_en', ['Périmètre']) && (
                                <div>
                                  <span className="text-sm font-semibold text-foreground">{t('perimeter')}</span>
                                  <p className="text-sm font-light">
                                    {getLocalizedValue(hit, 'Périmètre_fr', 'Périmètre_en', ['Périmètre'])}
                                  </p>
                                </div>
                              )}
                              <div>
                                <span className="text-sm font-semibold text-foreground">{t('source')}</span>
                                <div className="flex items-center gap-3">
                                  {getSourceLogo(hit.Source) && (
                                    <img 
                                      src={getSourceLogo(hit.Source)!}
                                      alt={`Logo ${hit.Source}`}
                                      className="w-[44px] h-[44px] md:w-[50px] md:h-[50px] object-contain flex-shrink-0"
                                    />
                                  )}
                                  <p
                                    className="text-sm font-light text-foreground"
                                    dangerouslySetInnerHTML={getHighlightedText(hit, 'Source')}
                                  />
                                </div>
                              </div>
                              {hit.dataset_name && (
                                <div>
                                  <span className="text-sm font-semibold text-foreground">{t('imported_dataset')}</span>
                                  <p className="text-sm font-light">{hit.dataset_name}</p>
                                </div>
                              )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {getLocalizedValue(hit, 'Localisation_fr', 'Localisation_en', ['Localisation']) && (
                              <Badge variant="secondary">
                                {getLocalizedValue(hit, 'Localisation_fr', 'Localisation_en', ['Localisation'])}
                              </Badge>
                            )}
                            {hit.Date && <Badge variant="outline">{hit.Date}</Badge>}
                            {getLocalizedValue(hit, 'Secteur_fr', 'Secteur_en', ['Secteur']) && (
                              <Badge variant="outline">
                                {getLocalizedValue(hit, 'Secteur_fr', 'Secteur_en', ['Secteur'])}
                              </Badge>
                            )}
                            {getLocalizedValue(hit, 'Sous-secteur_fr', 'Sous-secteur_en', ['Sous-secteur']) && (
                              <Badge variant="outline">
                                {getLocalizedValue(hit, 'Sous-secteur_fr', 'Sous-secteur_en', ['Sous-secteur'])}
                              </Badge>
                            )}
                              </div>

                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t space-y-3">
                              {/* Bouton Agent documentaire */}
                              <Button
                                variant="default"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setChatConfig({
                                    isOpen: true,
                                    source: hit.Source,
                                    productName: getLocalizedValue(hit, 'Nom_fr', 'Nom_en', ['Nom']) || ''
                                  });
                                }}
                                className="w-full sm:w-auto"
                              >
                                <Sparkles className="h-4 w-4 mr-2" />
                                {currentLang === 'fr' ? 'Agent documentaire' : 'Documentation agent'}
                              </Button>
                              {getLocalizedValue(hit, 'Description_fr', 'Description_en', ['Description']) && (
                                <div>
                                  <span className="text-sm font-semibold text-foreground">{t('description')}</span>
                                  <div className="mt-1 text-xs font-light text-muted-foreground">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      rehypePlugins={[rehypeRaw]}
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
                                        strong: ({ children, ...props }) => (
                                          <strong className="font-bold" {...props}>{children}</strong>
                                        ),
                                        em: ({ children, ...props }) => (
                                          <em className="italic" {...props}>{children}</em>
                                        ),
                                        mark: ({ children, ...props }) => (
                                          <mark className="bg-purple-200 px-1 rounded" {...props}>{children}</mark>
                                        )
                                      }}
                                    >
                                      {(() => {
                                        const highlighted = getHighlightedText(hit, 'Description');
                                        return highlighted.__html || getLocalizedValue(hit, 'Description_fr', 'Description_en', ['Description']);
                                      })()}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              )}
                              {getLocalizedValue(hit, 'Commentaires_fr', 'Commentaires_en', ['Commentaires']) && (
                                <div>
                                  <span className="text-sm font-semibold text-foreground">{t('commentary')}</span>
                                  <div className="mt-1 text-xs font-light text-muted-foreground">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      rehypePlugins={[rehypeRaw]}
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
                                        strong: ({ children, ...props }) => (
                                          <strong className="font-bold" {...props}>{children}</strong>
                                        ),
                                        em: ({ children, ...props }) => (
                                          <em className="italic" {...props}>{children}</em>
                                        ),
                                        mark: ({ children, ...props }) => (
                                          <mark className="bg-purple-200 px-1 rounded" {...props}>{children}</mark>
                                        )
                                      }}
                                    >
                                      {(() => {
                                        const highlighted = getHighlightedText(hit, 'Commentaires');
                                        return highlighted.__html || getLocalizedValue(hit, 'Commentaires_fr', 'Commentaires_en', ['Commentaires']);
                                      })()}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              )}
                              {getLocalizedValue(hit, 'Contributeur', 'Contributeur_en') && (
                                <div>
                                  <span className="text-sm font-semibold text-foreground">{t('contributor')}</span>
                                  <div className="mt-1 text-xs font-light text-muted-foreground">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      rehypePlugins={[rehypeRaw]}
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
                                        strong: ({ children, ...props }) => (
                                          <strong className="font-bold" {...props}>{children}</strong>
                                        ),
                                        em: ({ children, ...props }) => (
                                          <em className="italic" {...props}>{children}</em>
                                        ),
                                        mark: ({ children, ...props }) => (
                                          <mark className="bg-purple-200 px-1 rounded" {...props}>{children}</mark>
                                        )
                                      }}
                                    >
                                      {(() => {
                                        const highlighted = getHighlightedText(hit, 'Contributeur');
                                        return highlighted.__html || getLocalizedValue(hit, 'Contributeur', 'Contributeur_en');
                                      })()}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              )}
                              {getLocalizedValue(hit, 'Méthodologie', 'Méthodologie_en') && (
                                <div>
                                  <span className="text-sm font-semibold text-foreground">{t('methodology')}</span>
                                  <div className="mt-1 text-xs font-light text-muted-foreground">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      rehypePlugins={[rehypeRaw]}
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
                                        strong: ({ children, ...props }) => (
                                          <strong className="font-bold" {...props}>{children}</strong>
                                        ),
                                        em: ({ children, ...props }) => (
                                          <em className="italic" {...props}>{children}</em>
                                        ),
                                        mark: ({ children, ...props }) => (
                                          <mark className="bg-purple-200 px-1 rounded" {...props}>{children}</mark>
                                        )
                                      }}
                                    >
                                      {(() => {
                                        const highlighted = getHighlightedText(hit, 'Méthodologie');
                                        return highlighted.__html || getLocalizedValue(hit, 'Méthodologie', 'Méthodologie_en');
                                      })()}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              )}
                              {getLocalizedValue(hit, 'Type_de_données', 'Type_de_données_en') && (
                                <div>
                                  <span className="text-sm font-semibold text-foreground">{t('data_type')}</span>
                                  <p
                                    className="mt-1 text-xs font-light text-muted-foreground"
                                    dangerouslySetInnerHTML={getHighlightedText(hit, 'Type de données')}
                                  />
                                </div>
                              )}
                              {hit.Incertitude && (
                                <div>
                                  <span className="text-sm font-semibold text-foreground">{t('uncertainty')}</span>
                                  <p
                                    className="mt-1 text-xs font-light text-muted-foreground"
                                    dangerouslySetInnerHTML={getHighlightedText(hit, 'Incertitude')}
                                  />
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
          ) : (
            /* Table View */
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-white rounded-lg overflow-hidden">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="border-b border-border">
                    <th className="p-3 text-left text-sm font-semibold text-foreground w-12"></th>
                    <th className="p-3 text-left text-sm font-semibold text-foreground w-12">
                      <Checkbox
                        checked={selectedItems.size === hits.length && hits.length > 0}
                        onCheckedChange={handleSelectAll}
                        className="border-indigo-950 data-[state=checked]:bg-indigo-950"
                      />
                    </th>
                    <th className="p-3 text-left text-sm font-semibold text-foreground min-w-[200px]">{t('name')}</th>
                    <th className="p-3 text-left text-sm font-semibold text-foreground min-w-[120px]">FE</th>
                    <th className="p-3 text-left text-sm font-semibold text-foreground min-w-[150px]">{t('unit')}</th>
                    <th className="p-3 text-left text-sm font-semibold text-foreground min-w-[120px]">{t('perimeter')}</th>
                    <th className="p-3 text-left text-sm font-semibold text-foreground min-w-[150px]">{t('source')}</th>
                    <th className="p-3 text-left text-sm font-semibold text-foreground min-w-[120px]">{t('location')}</th>
                    <th className="p-3 text-left text-sm font-semibold text-foreground w-24">{t('date')}</th>
                    <th className="p-3 text-left text-sm font-semibold text-foreground w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {hits.map((hit) => {
                    const isExpanded = expandedRows.has(hit.objectID);
                    const isFav = isFavorite(hit.objectID);
                    const shouldBlur = isHitBlurred(hit);
                    const isPrivateHit = Boolean(hit.workspace_id) || hit.import_type === 'imported';

                    return (
                      <React.Fragment key={hit.objectID}>
                        <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpansion(hit.objectID);
                              }}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                          <td className="p-3">
                            <Checkbox
                              checked={selectedItems.has(hit.objectID)}
                              onCheckedChange={() => handleItemSelect(hit.objectID)}
                              disabled={shouldBlur}
                              title={shouldBlur ? getTooltip('blurredNotSelectable') : ''}
                              className="border-indigo-950 data-[state=checked]:bg-indigo-950"
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              <div className="text-sm text-foreground">
                                <AlgoliaHighlight attribute={currentLang === 'fr' ? 'Nom_fr' : 'Nom_en'} hit={hit} />
                              </div>
                              {isPrivateHit && (
                                <Badge variant="secondary" className="text-[10px] leading-none px-2 py-0.5 w-fit">
                                  {t('imported_ef')}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <PaidBlur isBlurred={shouldBlur} showBadge>
                              <span className="text-sm font-bold text-primary">{formatFE(hit.FE)} kgCO₂eq</span>
                            </PaidBlur>
                          </td>
                          <td className="p-3 text-sm">
                            {getLocalizedValue(hit, 'Unite_fr', 'Unite_en', ["Unité donnée d'activité"])}
                          </td>
                          <td className="p-3 text-sm">
                            {getLocalizedValue(hit, 'Périmètre_fr', 'Périmètre_en', ['Périmètre'])}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {getSourceLogo(hit.Source) && (
                                <img 
                                  src={getSourceLogo(hit.Source)!}
                                  alt={`Logo ${hit.Source}`}
                                  className="w-8 h-8 object-contain flex-shrink-0"
                                />
                              )}
                              <span className="text-sm">{hit.Source}</span>
                            </div>
                          </td>
                          <td className="p-3 text-sm">
                            {getLocalizedValue(hit, 'Localisation_fr', 'Localisation_en', ['Localisation'])}
                          </td>
                          <td className="p-3 text-sm">
                            {hit.Date || '-'}
                          </td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (canUseFavorites() && !shouldBlur) handleFavoriteToggle(hit);
                              }}
                              disabled={!canUseFavorites() || shouldBlur}
                              className={`h-8 w-8 p-0 ${isFav ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-foreground'} ${(!canUseFavorites() || shouldBlur) ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={!canUseFavorites()
                                ? getTooltip('premiumOnly')
                                : (shouldBlur ? getTooltip('blurredNotAddable') : '')}
                            >
                              {!canUseFavorites() ? (
                                <Lock className="h-4 w-4" />
                              ) : (
                                <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
                              )}
                            </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={10} className="p-0">
                              <div className="bg-muted/20 p-6 border-t border-border">
                                <div className="space-y-4">
                                  {/* Bouton Agent documentaire */}
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setChatConfig({
                                        isOpen: true,
                                        source: hit.Source,
                                        productName: getLocalizedValue(hit, 'Nom_fr', 'Nom_en', ['Nom']) || ''
                                      });
                                    }}
                                    className="w-full sm:w-auto"
                                  >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    {currentLang === 'fr' ? 'Agent documentaire' : 'Documentation agent'}
                                  </Button>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {getLocalizedValue(hit, 'Description_fr', 'Description_en', ['Description']) && (
                                      <div className="md:col-span-2">
                                        <span className="text-sm font-semibold text-foreground">{t('description')}</span>
                                        <div className="mt-1 text-xs font-light text-muted-foreground">
                                          <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeRaw]}
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
                                              strong: ({ children, ...props }) => (
                                                <strong className="font-bold" {...props}>{children}</strong>
                                              ),
                                              em: ({ children, ...props }) => (
                                                <em className="italic" {...props}>{children}</em>
                                              ),
                                              mark: ({ children, ...props }) => (
                                                <mark className="bg-purple-200 px-1 rounded" {...props}>{children}</mark>
                                              )
                                            }}
                                          >
                                            {(() => {
                                              const highlighted = getHighlightedText(hit, 'Description');
                                              return highlighted.__html || getLocalizedValue(hit, 'Description_fr', 'Description_en', ['Description']);
                                            })()}
                                          </ReactMarkdown>
                                        </div>
                                      </div>
                                    )}
                                    {getLocalizedValue(hit, 'Commentaires_fr', 'Commentaires_en', ['Commentaires']) && (
                                      <div className="md:col-span-2">
                                        <span className="text-sm font-semibold text-foreground">{t('commentary')}</span>
                                        <div className="mt-1 text-xs font-light text-muted-foreground">
                                          <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeRaw]}
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
                                              strong: ({ children, ...props }) => (
                                                <strong className="font-bold" {...props}>{children}</strong>
                                              ),
                                              em: ({ children, ...props }) => (
                                                <em className="italic" {...props}>{children}</em>
                                              ),
                                              mark: ({ children, ...props }) => (
                                                <mark className="bg-purple-200 px-1 rounded" {...props}>{children}</mark>
                                              )
                                            }}
                                          >
                                            {(() => {
                                              const highlighted = getHighlightedText(hit, 'Commentaires');
                                              return highlighted.__html || getLocalizedValue(hit, 'Commentaires_fr', 'Commentaires_en', ['Commentaires']);
                                            })()}
                                          </ReactMarkdown>
                                        </div>
                                      </div>
                                    )}
                                    {getLocalizedValue(hit, 'Secteur_fr', 'Secteur_en', ['Secteur']) && (
                                      <div>
                                        <span className="text-sm font-semibold text-foreground">{t('sector')}</span>
                                        <p className="mt-1 text-sm font-light">
                                          {getLocalizedValue(hit, 'Secteur_fr', 'Secteur_en', ['Secteur'])}
                                        </p>
                                      </div>
                                    )}
                                    {getLocalizedValue(hit, 'Sous-secteur_fr', 'Sous-secteur_en', ['Sous-secteur']) && (
                                      <div>
                                        <span className="text-sm font-semibold text-foreground">{t('sub_sector')}</span>
                                        <p className="mt-1 text-sm font-light">
                                          {getLocalizedValue(hit, 'Sous-secteur_fr', 'Sous-secteur_en', ['Sous-secteur'])}
                                        </p>
                                      </div>
                                    )}
                                    {getLocalizedValue(hit, 'Contributeur', 'Contributeur_en') && (
                                      <div>
                                        <span className="text-sm font-semibold text-foreground">{t('contributor')}</span>
                                        <div className="mt-1 text-xs font-light text-muted-foreground">
                                          <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeRaw]}
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
                                              strong: ({ children, ...props }) => (
                                                <strong className="font-bold" {...props}>{children}</strong>
                                              ),
                                              em: ({ children, ...props }) => (
                                                <em className="italic" {...props}>{children}</em>
                                              ),
                                              mark: ({ children, ...props }) => (
                                                <mark className="bg-purple-200 px-1 rounded" {...props}>{children}</mark>
                                              )
                                            }}
                                          >
                                            {(() => {
                                              const highlighted = getHighlightedText(hit, 'Contributeur');
                                              return highlighted.__html || getLocalizedValue(hit, 'Contributeur', 'Contributeur_en');
                                            })()}
                                          </ReactMarkdown>
                                        </div>
                                      </div>
                                    )}
                                    {getLocalizedValue(hit, 'Méthodologie', 'Méthodologie_en') && (
                                      <div>
                                        <span className="text-sm font-semibold text-foreground">{t('methodology')}</span>
                                        <div className="mt-1 text-xs font-light text-muted-foreground">
                                          <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeRaw]}
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
                                              strong: ({ children, ...props }) => (
                                                <strong className="font-bold" {...props}>{children}</strong>
                                              ),
                                              em: ({ children, ...props }) => (
                                                <em className="italic" {...props}>{children}</em>
                                              ),
                                              mark: ({ children, ...props }) => (
                                                <mark className="bg-purple-200 px-1 rounded" {...props}>{children}</mark>
                                              )
                                            }}
                                          >
                                            {(() => {
                                              const highlighted = getHighlightedText(hit, 'Méthodologie');
                                              return highlighted.__html || getLocalizedValue(hit, 'Méthodologie', 'Méthodologie_en');
                                            })()}
                                          </ReactMarkdown>
                                        </div>
                                      </div>
                                    )}
                                    {getLocalizedValue(hit, 'Type_de_données', 'Type_de_données_en') && (
                                      <div>
                                        <span className="text-sm font-semibold text-foreground">{t('data_type')}</span>
                                        <p
                                          className="mt-1 text-xs font-light text-muted-foreground"
                                          dangerouslySetInnerHTML={getHighlightedText(hit, 'Type de données')}
                                        />
                                      </div>
                                    )}
                                    {hit.Incertitude && (
                                      <div>
                                        <span className="text-sm font-semibold text-foreground">{t('uncertainty')}</span>
                                        <p
                                          className="mt-1 text-xs font-light text-muted-foreground"
                                          dangerouslySetInnerHTML={getHighlightedText(hit, 'Incertitude')}
                                        />
                                      </div>
                                    )}
                                    {hit.dataset_name && (
                                      <div>
                                        <span className="text-sm font-semibold text-foreground">{t('imported_dataset')}</span>
                                        <p className="mt-1 text-sm font-light">{hit.dataset_name}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <PaginationComponent />
        </>
      )}

      {/* Modal Assistant IA */}
      {chatConfig && (
        <LlamaCloudChatModal
          isOpen={chatConfig.isOpen}
          onClose={() => setChatConfig(null)}
          sourceName={chatConfig.source}
          productName={chatConfig.productName}
          language={currentLang}
        />
      )}
    </div>
  );
};