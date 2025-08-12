export interface AlgoliaHit {
  objectID: string;
  Nom: string;
  Description: string;
  FE: number;
  "Unité donnée d'activité": string;
  Source: string;
  Secteur: string;
  'Sous-secteur': string;
  Localisation: string;
  Date: number;
  Incertitude: string;
  Périmètre: string;
  Contributeur: string;
  Commentaires: string;
  _highlightResult?: any;
  // Méta potentielle pour distinguer public/privé
  workspace_id?: string;
  import_type?: string;
  __indexName?: string;
}
