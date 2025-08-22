import React from 'react';
import { useSearchBox, useStats, useInstantSearch } from 'react-instantsearch';
import { Search, X } from "lucide-react";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSearchControls } from './SearchProvider';

export const SearchBox: React.FC = () => {
  const { query, refine } = useSearchBox();
  const { nbHits } = useStats();
  const { refresh } = useInstantSearch();
  const controls = (() => { try { return useSearchControls(); } catch { return null; } })();

  const handleClear = () => {
    refine("");
  };

  const handleSearch = () => {
    const trimmed = (query || '').trim();
    if (trimmed.length < 3) {
      // Ne pas déclencher de recherche réseau (UX stricte 3+)
      return;
    }
    try { controls?.forceNextSearch(); } catch {}
    refine(trimmed);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-8 top-1/2 transform -translate-y-1/2 text-indigo-950/60 h-6 w-6" />
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
      </div>
    </div>
  );
};