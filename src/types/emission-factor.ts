export interface EmissionFactor {
  id: string;
  nom: string;
  description?: string;
  fe: number;
  uniteActivite: string;
  source: string;
  secteur: string;
  sousSecteur?: string;
  localisation: string;
  date: number;
  incertitude?: string;
  perimetre?: string;
  contributeur?: string;
  contributeur_en?: string;
  methodologie?: string;
  methodologie_en?: string;
  typeDonnees?: string;
  typeDonnees_en?: string;
  commentaires?: string;
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