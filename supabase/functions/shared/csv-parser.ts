// Parser CSV robuste pour gérer les cas complexes de la Base Carbone
// Gère les guillemets, virgules intégrées, échappements, et caractères spéciaux

export interface CsvRow {
  [key: string]: string;
}

export class RobustCsvParser {
  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Échappement de guillemet : "" -> "
          current += '"';
          i += 2;
        } else {
          // Début ou fin de guillemets
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Séparateur de colonne (seulement si pas dans des guillemets)
        result.push(current.trim());
        current = '';
        i++;
      } else {
        // Caractère normal
        current += char;
        i++;
      }
    }

    // Ajouter le dernier champ
    result.push(current.trim());
    return result;
  }

  static parseCSVContent(content: string): { headers: string[]; rows: CsvRow[] } {
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (lines.length < 1) {
      throw new Error('CSV vide ou invalide');
    }

    // Parser l'en-tête
    const headers = this.parseCSVLine(lines[0]);
    
    // Validation des colonnes requises
    const requiredColumns = ['ID', 'Nom', 'FE', 'Unité donnée d\'activité', 'Source', 'Périmètre', 'Localisation', 'Date'];
    const missingColumns = requiredColumns.filter(col => 
      !headers.some(h => h.toLowerCase() === col.toLowerCase())
    );

    if (missingColumns.length > 0) {
      throw new Error(`Colonnes manquantes: ${missingColumns.join(', ')}`);
    }

    // Parser les lignes de données
    const rows: CsvRow[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCSVLine(lines[i]);
        
        // S'assurer qu'on a le bon nombre de colonnes
        if (values.length !== headers.length) {
          if (errors.length < 10) {
            errors.push(`Ligne ${i + 1}: ${values.length} colonnes au lieu de ${headers.length}`);
          }
          continue;
        }

        const row: CsvRow = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });

        // Validation des champs critiques
        const source = row['Source']?.trim();
        const nom = row['Nom']?.trim();
        const fe = row['FE']?.trim();

        if (!source || !nom || !fe) {
          if (errors.length < 10) {
            errors.push(`Ligne ${i + 1}: Champs critiques manquants (Source: "${source}", Nom: "${nom}", FE: "${fe}")`);
          }
          continue;
        }

        // Validation que la source n'est pas un nombre ou une unité
        if (/^\d+$/.test(source) || source.match(/^(kg|m|l|€|kWh|km)$/i)) {
          if (errors.length < 10) {
            errors.push(`Ligne ${i + 1}: Source invalide "${source}" (semble être un nombre ou une unité)`);
          }
          continue;
        }

        rows.push(row);
      } catch (error) {
        if (errors.length < 10) {
          errors.push(`Ligne ${i + 1}: Erreur de parsing - ${error}`);
        }
      }
    }

    console.log(`✅ CSV parsé: ${rows.length} lignes valides, ${errors.length} erreurs`);
    if (errors.length > 0) {
      console.log(`⚠️ Erreurs de parsing:`, errors);
    }

    return { headers, rows };
  }

  static validateSourceName(source: string): boolean {
    if (!source || source.trim().length === 0) return false;
    if (/^\d+$/.test(source)) return false; // Pas juste un nombre
    if (source.match(/^(kg|m|l|€|kWh|km|unité|unit)$/i)) return false; // Pas une unité
    if (source.length < 2) return false; // Au moins 2 caractères
    return true;
  }

  static extractSourcesFromRows(rows: CsvRow[]): Map<string, number> {
    const sourcesCount = new Map<string, number>();
    
    for (const row of rows) {
      const source = row['Source']?.trim();
      if (source && this.validateSourceName(source)) {
        sourcesCount.set(source, (sourcesCount.get(source) || 0) + 1);
      }
    }
    
    return sourcesCount;
  }
}
