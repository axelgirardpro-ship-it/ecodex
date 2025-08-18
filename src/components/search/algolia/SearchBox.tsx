import React, { useState, useEffect, useRef } from 'react';
import { useSearchBox, useStats, useHits } from 'react-instantsearch';
import { Search, X, Clock, Zap } from "lucide-react";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSearchBoxSuggestions } from '@/hooks/useSmartSuggestions';
import { useOrigin } from '@/components/search/algolia/SearchProvider';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { Badge } from '@/components/ui/badge';

export const SearchBox: React.FC = () => {
  const { query, refine } = useSearchBox();
  const { nbHits } = useStats();
  const { hits } = useHits();
  const { origin } = useOrigin();
  const { 
    highlightedSuggestions, 
    groupedSuggestions, 
    loading: suggestionsLoading,
    isRecentSearches,
    getCacheStats
  } = useSearchBoxSuggestions(query, origin, {
    maxSuggestions: 8,
    enablePreloading: true,
    showCategories: true,
    groupByCategory: true,
    highlightMatches: true
  });
  const { recordSearch } = useSearchHistory();
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Logs de debug pour traquer les hints vs origine - mais seulement quand nécessaire
  const prevState = useRef({ origin, query, suggestions: 0 });
  React.useEffect(() => {
    const currentState = { origin, query, suggestions: highlightedSuggestions.length };
    
    // Log seulement si quelque chose d'important a changé
    if (import.meta.env.DEV && (
      prevState.current.origin !== currentState.origin ||
      prevState.current.query !== currentState.query ||
      Math.abs(prevState.current.suggestions - currentState.suggestions) > 5
    )) {
      console.log('[OptimizedSearchBox] state change:', { 
        from: prevState.current,
        to: currentState,
        cacheStats: getCacheStats()
      });
      prevState.current = currentState;
    }
  }, [origin, query, highlightedSuggestions.length, getCacheStats]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleClear = () => {
    refine("");
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    refine(suggestion);
    setShowSuggestions(false);
    recordSearch(suggestion, {}, 0);
  };

  const handleSearch = () => {
    if (query.trim()) {
      recordSearch(query, {}, nbHits || 0);
    }
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-4" ref={dropdownRef}>
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-8 top-1/2 transform -translate-y-1/2 text-indigo-950/60 h-6 w-6" />
            <Input
              type="text"
              value={query}
              onChange={(e) => {
                refine(e.target.value);
                setShowSuggestions(e.target.value.length > 0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              placeholder="Rechercher des facteurs d'émission..."
              className="flex-1 bg-white border-white/20 text-indigo-950 placeholder:text-indigo-950/60 font-montserrat h-20 text-2xl pl-20 pr-20 rounded-xl"
            />
            {query && (
              <button 
                onClick={handleClear} 
                className="absolute right-8 top-1/2 transform -translate-y-1/2 text-indigo-950/60 hover:text-indigo-950"
              >
                <X className="h-6 w-6" />
              </button>
            )}
          </div>
          <Button 
            variant="hero"
            onClick={handleSearch}
            className="h-20 px-10 text-xl rounded-xl"
          >
            Rechercher
          </Button>
        </div>

        {showSuggestions && (highlightedSuggestions.length > 0) && (
          <div className="absolute top-full left-0 right-[200px] bg-white border border-white/20 rounded-xl shadow-xl z-50 mt-2">
            {suggestionsLoading && (
              <div className="p-3 text-sm text-indigo-950/70 border-b border-white/20 bg-white font-montserrat flex items-center gap-2">
                <Zap className="h-3 w-3 animate-pulse" />
                Recherche optimisée...
              </div>
            )}
            
            {isRecentSearches ? (
              <>
                <div className="p-3 text-sm text-indigo-950/70 border-b border-white/20 bg-white flex items-center gap-2 font-montserrat">
                  <Clock className="h-3 w-3" />
                  Recherches récentes
                </div>
                <div className="max-h-32 overflow-y-auto bg-white">
                  {highlightedSuggestions.map((suggestion, index) => (
                    <button 
                      key={`recent-${index}`} 
                      onClick={() => handleSuggestionClick(suggestion.label)} 
                      className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-sm text-indigo-950 bg-white flex items-center gap-2 font-montserrat"
                    >
                      <Clock className="h-3 w-3 text-indigo-950/60" />
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="p-3 text-sm text-indigo-950/70 border-b border-white/20 bg-white font-montserrat flex items-center gap-2">
                  <Zap className="h-3 w-3" />
                  Suggestions intelligentes ({highlightedSuggestions.length})
                </div>
                <div className="max-h-40 overflow-y-auto bg-white">
                  {Object.keys(groupedSuggestions).length > 0 ? (
                    // Rendu groupé par catégorie
                    Object.entries(groupedSuggestions).map(([category, suggestions]) => (
                      <div key={category}>
                        {category !== 'Autres' && (
                          <div className="px-4 py-2 text-xs text-indigo-950/50 bg-gray-50 font-montserrat">
                            {category}
                          </div>
                        )}
                        {suggestions.map((suggestion, index) => (
                          <button 
                            key={`${category}-${index}`} 
                            onClick={() => handleSuggestionClick(suggestion.label)} 
                            className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-sm text-indigo-950 bg-white font-montserrat flex items-center gap-2"
                          >
                            <span 
                              className="truncate flex-1"
                            dangerouslySetInnerHTML={{ 
                                __html: suggestion.label 
                              }}
                            />
                            {suggestion.isPrivate && (
                              <Badge variant="secondary" className="text-[10px] leading-none px-2 py-0.5">
                                FE importé
                              </Badge>
                            )}
                            {suggestion.source && (
                              <Badge variant="outline" className="text-[10px] leading-none px-2 py-0.5">
                                {suggestion.source}
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    ))
                  ) : (
                    // Rendu simple
                    highlightedSuggestions.map((suggestion, index) => (
                      <button 
                        key={`suggestion-${index}`} 
                        onClick={() => handleSuggestionClick(suggestion.label)} 
                        className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-sm text-indigo-950 bg-white font-montserrat flex items-center gap-2"
                      >
                        <span 
                          className="truncate flex-1"
                          dangerouslySetInnerHTML={{ 
                            __html: suggestion.highlightedLabel || suggestion.label 
                          }}
                        />
                        {suggestion.isPrivate && (
                          <Badge variant="secondary" className="text-[10px] leading-none px-2 py-0.5">
                            FE importé
                          </Badge>
                        )}
                        {suggestion.source && (
                          <Badge variant="outline" className="text-[10px] leading-none px-2 py-0.5">
                            {suggestion.source}
                          </Badge>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      
    </div>
  );
};