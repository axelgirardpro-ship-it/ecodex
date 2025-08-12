import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface Filters {
  source: string;
  secteur: string;
  sousSecteur: string;
  uniteActivite: string;
  localisation: string;
  anneeRapport: string;
}

interface FilterPanelProps {
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: string) => void;
  onResetFilters: () => void;
}

export const FilterPanel = ({ filters, onFilterChange, onResetFilters }: FilterPanelProps) => {
  const { currentWorkspace } = useWorkspace();
  const [filterOptions, setFilterOptions] = useState({
    source: [] as string[],
    secteur: [] as string[],
    sousSecteur: [] as string[],
    uniteActivite: [] as string[],
    localisation: [] as string[],
    date: [] as string[]
  });

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        let query = supabase.from('emission_factors').select('"Source", "Secteur", "Sous-secteur", "Unité donnée d\'activité", "Localisation", "Date"');
        
        // RLS policies now handle access control automatically
        // No need for manual filtering based on is_public

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching filter options:', error);
          return;
        }

        // Extract unique values for each filter
        const sources = [...new Set(data?.map(item => item["Source"]).filter(Boolean))] as string[];
        const secteurs = [...new Set(data?.map(item => item["Secteur"]).filter(Boolean))] as string[];
        const sousSecteurs = [...new Set(data?.map(item => item["Sous-secteur"]).filter(Boolean))] as string[];
        const unites = [...new Set(data?.map(item => item["Unité donnée d'activité"]).filter(Boolean))] as string[];
        const localisations = [...new Set(data?.map(item => item["Localisation"]).filter(Boolean))] as string[];
        const dates = [...new Set(data?.map(item => item["Date"]).filter(Boolean))] as (string | number)[];

        setFilterOptions({
          source: sources.sort(),
          secteur: secteurs.sort(),
          sousSecteur: sousSecteurs.sort(),
          uniteActivite: unites.sort(),
          localisation: localisations.sort(),
          date: dates.sort().reverse().map(String)
        });
      } catch (error) {
        console.error('Error in fetchFilterOptions:', error);
      }
    };

    fetchFilterOptions();
  }, [currentWorkspace]);

  const hasActiveFilters = Object.values(filters).some(value => value !== "");

  return (
    <div className="bg-filter-bg p-4 rounded-lg border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">FILTRER PAR :</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="text-slate-950 hover:text-slate-800"
          >
            <X className="w-4 h-4 mr-1" />
            RÉINITIALISER LES FILTRES
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Select value={filters.source} onValueChange={(value) => onFilterChange("source", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.source.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.secteur} onValueChange={(value) => onFilterChange("secteur", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Secteur" />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.secteur.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.sousSecteur} onValueChange={(value) => onFilterChange("sousSecteur", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Sous-secteur" />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.sousSecteur.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.uniteActivite} onValueChange={(value) => onFilterChange("uniteActivite", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Unité" />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.uniteActivite.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.localisation} onValueChange={(value) => onFilterChange("localisation", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Localisation" />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.localisation.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.anneeRapport} onValueChange={(value) => onFilterChange("anneeRapport", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.date.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};