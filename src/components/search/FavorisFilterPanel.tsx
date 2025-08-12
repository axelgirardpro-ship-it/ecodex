import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Search } from "lucide-react";

export interface FavoritesFilters {
  search: string;
  source: string;
  localisation: string;
  date: string;
  importType: 'all' | 'imported' | 'not_imported';
}

interface FavoritesFilterPanelProps {
  filters: FavoritesFilters;
  onFiltersChange: (filters: FavoritesFilters) => void;
  availableSources: string[];
  availableLocations: string[];
  availableDates: string[];
}

export const FavoritesFilterPanel = ({
  filters,
  onFiltersChange,
  availableSources,
  availableLocations,
  availableDates
}: FavoritesFilterPanelProps) => {
  const updateFilter = (key: keyof FavoritesFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      source: '',
      localisation: '',
      date: '',
      importType: 'all'
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== '' && value !== 'all'
  );

  return (
    <Card className="mb-6 bg-primary border-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-primary-foreground">
            <Search className="w-5 h-5 mr-2" />
            Filtres de recherche
          </CardTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-primary-foreground hover:bg-primary-foreground/10">
              <X className="w-4 h-4 mr-2" />
              Effacer les filtres
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Bar */}
        <div className="space-y-2">
          <Label htmlFor="search" className="text-primary-foreground">Rechercher</Label>
          <Input
            id="search"
            placeholder="Rechercher dans les favoris..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
          />
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Source Filter */}
          <div className="space-y-2">
            <Label className="text-primary-foreground">Source</Label>
            <Select value={filters.source || 'all'} onValueChange={(value) => updateFilter('source', value === 'all' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Toutes les sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les sources</SelectItem>
                {availableSources.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location Filter */}
          <div className="space-y-2">
            <Label className="text-primary-foreground">Localisation</Label>
            <Select value={filters.localisation || 'all'} onValueChange={(value) => updateFilter('localisation', value === 'all' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Toutes les localisations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les localisations</SelectItem>
                {availableLocations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Filter */}
          <div className="space-y-2">
            <Label className="text-primary-foreground">Date</Label>
            <Select value={filters.date || 'all'} onValueChange={(value) => updateFilter('date', value === 'all' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Toutes les dates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les dates</SelectItem>
                {availableDates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Import Type Filter */}
          <div className="space-y-2">
            <Label className="text-primary-foreground">Type d'import</Label>
            <Select value={filters.importType} onValueChange={(value) => updateFilter('importType', value as FavoritesFilters['importType'])}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="imported">Importés</SelectItem>
                <SelectItem value="not_imported">Non importés</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="text-sm text-primary-foreground/80">Filtres actifs:</span>
            {filters.search && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Recherche: "{filters.search}"
                <X 
                  className="w-3 h-3 cursor-pointer" 
                  onClick={() => updateFilter('search', '')}
                />
              </Badge>
            )}
            {filters.source && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Source: {filters.source}
                <X 
                  className="w-3 h-3 cursor-pointer" 
                  onClick={() => updateFilter('source', '')}
                />
              </Badge>
            )}
            {filters.localisation && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Localisation: {filters.localisation}
                <X 
                  className="w-3 h-3 cursor-pointer" 
                  onClick={() => updateFilter('localisation', '')}
                />
              </Badge>
            )}
            {filters.date && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Date: {filters.date}
                <X 
                  className="w-3 h-3 cursor-pointer" 
                  onClick={() => updateFilter('date', '')}
                />
              </Badge>
            )}
            {filters.importType !== 'all' && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Type: {filters.importType === 'imported' ? 'Importés' : 'Non importés'}
                <X 
                  className="w-3 h-3 cursor-pointer" 
                  onClick={() => updateFilter('importType', 'all')}
                />
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};