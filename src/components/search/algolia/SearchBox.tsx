import React, { useState, useEffect, useRef } from 'react';
import { useSearchBox, useStats, useHits } from 'react-instantsearch';
import { Search, X, Clock } from "lucide-react";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSuggestions, SuggestionItem } from '@/hooks/useSuggestions';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { Badge } from '@/components/ui/badge';

export const SearchBox: React.FC = () => {
  const { query, refine } = useSearchBox();
  const { nbHits } = useStats();
  const { hits } = useHits();
  const { suggestions, recentSearches } = useSuggestions(query);
  const { recordSearch } = useSearchHistory();
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  console.log('SearchBox render:', { query, nbHits, hitsLength: hits.length });

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
                console.log('Search input change:', e.target.value);
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

        {showSuggestions && (suggestions.length > 0 || recentSearches.length > 0) && (
          <div className="absolute top-full left-0 right-[200px] bg-white border border-white/20 rounded-xl shadow-xl z-50 mt-2">
            {suggestions.length > 0 && (
              <>
                <div className="p-3 text-sm text-indigo-950/70 border-b border-white/20 bg-white font-montserrat">
                  Suggestions
                </div>
                <div className="max-h-40 overflow-y-auto bg-white">
                  {suggestions.map((s: SuggestionItem, index) => (
                    <button 
                      key={`suggestion-${index}`} 
                      onClick={() => handleSuggestionClick(s.label)} 
                      className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-sm text-indigo-950 bg-white font-montserrat flex items-center gap-2"
                    >
                      <span className="truncate flex-1">{s.label}</span>
                      {s.isPrivate && (
                        <Badge variant="secondary" className="text-[10px] leading-none px-2 py-0.5">
                          FE importé
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
            
            {recentSearches.length > 0 && (
              <>
                <div className="p-3 text-sm text-indigo-950/70 border-b border-white/20 bg-white flex items-center gap-2 font-montserrat">
                  <Clock className="h-3 w-3" />
                  Recherches récentes
                </div>
                <div className="max-h-32 overflow-y-auto bg-white">
                  {recentSearches.map((search, index) => (
                    <button 
                      key={`recent-${index}`} 
                      onClick={() => handleSuggestionClick(search)} 
                      className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-sm text-indigo-950 bg-white flex items-center gap-2 font-montserrat"
                    >
                      <Clock className="h-3 w-3 text-indigo-950/60" />
                      {search}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      
    </div>
  );
};