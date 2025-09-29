import React from 'react';
import { useSearchBox, useStats, useInstantSearch } from 'react-instantsearch';
import { useTranslation } from 'react-i18next';
import { Search, X } from "lucide-react";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSearchControls } from './SearchProvider';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const SearchBox: React.FC = () => {
  const { query, refine } = useSearchBox();
  const { nbHits } = useStats();
  const { refresh } = useInstantSearch();
  const controls = useSearchControls();
  const { t } = useTranslation('search');

  // Pas de debounce: retour immédiat requis par l'UX
  const [inputValue, setInputValue] = React.useState<string>(query);

  // Synchroniser l'input quand la query change (clear externe, etc.)
  React.useEffect(() => {
    setInputValue(query);
  }, [query]);

  const handleClear = () => {
    setInputValue("");
    refine("");
  };

  const handleSearch = () => {
    const trimmed = (inputValue || '').trim();
    if (trimmed.length < 3) {
      // Ne pas déclencher de recherche réseau (UX stricte 3+)
      return;
    }
    try { 
      controls?.forceNextSearch(); 
    } catch (error) {
      console.warn('Force search failed:', error);
    }
    refine(trimmed);
    refresh();
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-indigo-950/60 h-5 w-5" />
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => {
                const next = e.target.value;
                setInputValue(next);
                const trimmed = next.trim();
                if (trimmed.length >= 3) {
                  refine(trimmed);
                } else {
                  // En deçà de 3 caractères: garder l'état local mais ne pas requêter
                  refine("");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              placeholder={t('search:search_box.placeholder')}
              className="flex-1 bg-white border-white/20 text-indigo-950 placeholder:text-indigo-950/60 font-montserrat h-14 text-lg pl-12 pr-12 rounded-lg shadow-sm"
            />
            {inputValue && (
              <button 
                onClick={handleClear} 
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-indigo-950/60 hover:text-indigo-950"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <Button 
            variant="hero"
            onClick={handleSearch}
            className="h-14 px-6 text-lg rounded-lg"
            disabled={(inputValue || '').trim().length > 0 && (inputValue || '').trim().length < 3}
          >
            {t('search:search_box.button')}
          </Button>
        </div>
        {(inputValue || '').trim().length < 3 && (
          <p className="mt-1 ml-1 text-xs md:text-[13px] leading-tight text-white/85">
            {t('search:search_box.min_chars_warning')}
          </p>
        )}
      </div>
    </div>
  );
};