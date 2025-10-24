import React, { useState, useEffect, useRef } from 'react';
import { useSearchBox, useStats, useInstantSearch } from 'react-instantsearch';
import { Search, X } from "lucide-react";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSearchControls } from '@/components/search/algolia/SearchProvider';

interface FavorisSearchBoxProps {
  favoriteIds?: string[];
}

export const FavorisSearchBox: React.FC<FavorisSearchBoxProps> = ({ favoriteIds = [] }) => {
  const { query, refine } = useSearchBox();
  const { nbHits } = useStats();
  const { refresh } = useInstantSearch();
  
  // Always call hooks at the top level (React rules of hooks)
  // Use optional chaining to handle the case where controls might not be available
  const controls = useSearchControls();

  const handleClear = () => {
    refine("");
  };

  const handleSearch = () => {
    // Pas d'enregistrement d'historique sur la page favoris
    const trimmed = (query || '').trim();
    if (trimmed.length < 3) {
      return;
    }
    // Use optional chaining - if controls is null/undefined, this is a no-op
    controls?.forceNextSearch();
    refine(trimmed);
    refresh();
  };

  return (
    <div className="space-y-4">{/* Dropdown removed for favoris page */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              type="text"
              value={query}
              onChange={(e) => {
                refine(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              placeholder={`Rechercher dans vos ${favoriteIds?.length || 0} favoris...`}
              className="flex-1 bg-background border-border text-foreground placeholder:text-muted-foreground h-12 text-base pl-12 pr-12 rounded-lg"
            />
            {query && (
              <button 
                onClick={handleClear} 
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <Button 
            variant="default"
            onClick={handleSearch}
            className="h-12 px-6 rounded-lg"
          >
            Rechercher
          </Button>
        </div>
      </div>
    </div>
  );
};