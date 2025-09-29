export interface EmissionFactor {
  id: string;
  nom: string;
  description?: string;
  fe: number;
  uniteActivite: string;
  perimetre?: string;
  source: string;
  localisation: string;
  date: number;
  secteur: string;
  sousSecteur?: string;
  commentaires?: string;
  incertitude?: string;
  contributeur?: string;
  contributeur_en?: string;
  methodologie?: string;
  methodologie_en?: string;
  typeDonnees?: string;
  typeDonnees_en?: string;
  description_en?: string;
  isFavorite?: boolean;
  workspace_id?: string;
}

export interface SearchFilters {
  source: string;
  secteur: string;
  sousSecteur: string;
  uniteActivite: string;
  localisation: string;
  anneeRapport: string;
}