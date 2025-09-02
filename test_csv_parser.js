// Test du parser CSV robuste
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') { current += '"'; i++; } 
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) { 
      result.push(current.trim()); current = ''; 
    } else { 
      current += char; 
    }
  }
  result.push(current.trim());
  return result;
}

// Test sur les lignes du fichier
const testLines = [
  'ID,Nom,Nom_en,Description,Description_en,FE,Unité donnée d\'activité,Unite_en,Source,Secteur,Secteur_en,Sous-secteur,Sous-secteur_en,Localisation,Localisation_en,Date,Incertitude,Périmètre,Périmètre_en,Contributeur,Commentaires,Commentaires_en',
  '675c7cf1-5434-4d19-bef0-8c2b54371e01,"(4s,5s)-1,1,2,2,3,3,4,5- octafluorocyclopentane  PRG à 100 ans","(4s,5s)-1,1,2,2,3,3,4,5- octafluorocyclopentane  GWP 100 years",Données téléchargées et extraites du site Internet [Base Empreinte® de l\'ADEME](https://base-empreinte.ademe.fr/donnees/download-data),Data downloaded and retrieved from the [Base Empreinte® website of ADEME](https://base-empreinte.ademe.fr/donnees/download-data),258,kg,kg,Base Carbone v23.6,Réfrigérants et gaz fugitifs,Refrigerants and Fugitive Gases,,,Monde,World,2023,30,,,ADEME,,',
  '9c228408-e752-47e0-93ce-56645344c9a0,(e)-1-chloro-2-fluoroethene  PRG à 100 ans,(e)-1-chloro-2-fluoroethene  GWP 100 years,Données téléchargées et extraites du site Internet [Base Empreinte® de l\'ADEME](https://base-empreinte.ademe.fr/donnees/download-data),Data downloaded and retrieved from the [Base Empreinte® website of ADEME](https://base-empreinte.ademe.fr/donnees/download-data),0.004,kg,kg,Base Carbone v23.6,Réfrigérants et gaz fugitifs,Refrigerants and Fugitive Gases,,,Monde,World,2023,30,,,ADEME,,'
];

console.log('=== Test du parser CSV ===');

testLines.forEach((line, idx) => {
  console.log(`\nLigne ${idx}:`);
  const parsed = parseCSVLine(line);
  console.log(`Colonnes: ${parsed.length}`);
  
  if (idx === 0) {
    console.log('Headers:', parsed.slice(0, 10));
  } else {
    const row = {};
    const headers = parseCSVLine(testLines[0]);
    headers.forEach((h, i) => { row[h] = parsed[i] || ''; });
    
    console.log('Row parsed:');
    console.log('- ID:', row['ID']);
    console.log('- Nom:', row['Nom']);
    console.log('- FE:', row['FE']);
    console.log('- Source:', row['Source']);
    console.log('- Localisation:', row['Localisation']);
    
    // Test validation
    const nom = String(row['Nom'] || '').trim();
    const fe = String(row['FE'] || '').trim();
    const source = String(row['Source'] || '').trim();
    const feNum = parseFloat(fe.replace(',', '.'));
    
    console.log('Validation:');
    console.log('- hasRequired:', Boolean(nom && fe && source));
    console.log('- feNum:', feNum, 'isFinite:', Number.isFinite(feNum));
    console.log('- Would pass:', Boolean(nom && fe && source && Number.isFinite(feNum)));
  }
});
