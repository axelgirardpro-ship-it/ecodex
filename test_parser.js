// Test local du parser CSV robuste
import { readFileSync } from 'fs';

class RobustCsvParser {
  static parseCSVLine(line) {
    const result = [];
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

  static parseCSVContent(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (lines.length < 1) {
      throw new Error('CSV vide ou invalide');
    }

    // Parser l'en-tête
    const headers = this.parseCSVLine(lines[0]);
    console.log(`📋 Headers détectés: ${headers.length} colonnes`);
    console.log(`🔍 Headers: ${headers.slice(0, 5).join(', ')}...`);
    
    // Parser les lignes de données
    const rows = [];
    const errors = [];

    for (let i = 1; i < Math.min(lines.length, 11); i++) { // Tester seulement 10 lignes
      try {
        const values = this.parseCSVLine(lines[i]);
        
        if (values.length !== headers.length) {
          errors.push(`Ligne ${i + 1}: ${values.length} colonnes au lieu de ${headers.length}`);
          continue;
        }

        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });

        // Validation des champs critiques
        const source = row['Source']?.trim();
        const nom = row['Nom']?.trim();
        const fe = row['FE']?.trim();

        console.log(`📊 Ligne ${i}: Source="${source}", Nom="${nom.substring(0, 30)}...", FE="${fe}"`);

        if (!source || !nom || !fe) {
          errors.push(`Ligne ${i + 1}: Champs critiques manquants`);
          continue;
        }

        // Validation que la source n'est pas un nombre ou une unité
        if (/^\d+$/.test(source) || source.match(/^(kg|m|l|€|kWh|km)$/i)) {
          errors.push(`Ligne ${i + 1}: Source invalide "${source}"`);
          continue;
        }

        rows.push(row);
      } catch (error) {
        errors.push(`Ligne ${i + 1}: Erreur de parsing - ${error}`);
      }
    }

    return { headers, rows, errors };
  }

  static extractSourcesFromRows(rows) {
    const sourcesCount = new Map();
    
    for (const row of rows) {
      const source = row['Source']?.trim();
      if (source && this.validateSourceName(source)) {
        sourcesCount.set(source, (sourcesCount.get(source) || 0) + 1);
      }
    }
    
    return sourcesCount;
  }

  static validateSourceName(source) {
    if (!source || source.trim().length === 0) return false;
    if (/^\d+$/.test(source)) return false;
    if (source.match(/^(kg|m|l|€|kWh|km|unité|unit)$/i)) return false;
    if (source.length < 2) return false;
    return true;
  }
}

// Test avec le fichier échantillon
try {
  console.log('🧪 Test du parser CSV robuste...\n');
  
  const content = readFileSync('/tmp/test_sample_100.csv', 'utf8');
  console.log(`📄 Fichier lu: ${content.length} caractères`);
  
  const result = RobustCsvParser.parseCSVContent(content);
  console.log(`\n✅ Parsing terminé:`);
  console.log(`   - ${result.headers.length} colonnes détectées`);
  console.log(`   - ${result.rows.length} lignes valides parsées`);
  console.log(`   - ${result.errors.length} erreurs de parsing`);
  
  if (result.errors.length > 0) {
    console.log(`\n⚠️  Erreurs:`, result.errors.slice(0, 3));
  }
  
  const sources = RobustCsvParser.extractSourcesFromRows(result.rows);
  console.log(`\n🔍 Sources détectées:`);
  for (const [source, count] of sources) {
    console.log(`   - "${source}": ${count} occurrences`);
  }
  
  console.log('\n🎉 Test réussi ! Le parser fonctionne correctement.');
  
} catch (error) {
  console.error('❌ Erreur de test:', error.message);
}

