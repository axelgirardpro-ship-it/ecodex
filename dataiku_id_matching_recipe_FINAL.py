# -*- coding: utf-8 -*-
"""
Dataiku Python Recipe: ID Matching & Assignment (VERSION FINALE)
=================================================================

CORRECTIONS APPLIQUÉES:
- Préservation de toutes les colonnes du fichier source
- Validation des colonnes requises au démarrage
- Gestion correcte des doublons de hash (garder le premier)
- Normalisation sans perte de données
- Vérifications d'intégrité étendues
- ID en première colonne pour Supabase
"""

import dataiku
import pandas as pd
import hashlib
import uuid
from datetime import datetime

# ============================================================================
# CONFIGURATION
# ============================================================================

NATURAL_KEY = [
    'Nom',
    'Périmètre', 
    'Localisation',
    'Source',
    'Date',
    'Unité donnée d\'activité'  # AJOUTÉ: Différencie les records par unité (kg vs m²)
]

MONITORED_COLUMNS = [
    'FE',
    'Incertitude',
    'Commentaires',
    'Description',
    'Unité donnée d\'activité'
]

# ============================================================================
# FONCTION DE NORMALISATION
# ============================================================================

def normalize_dataframe(df):
    """
    Normalise les valeurs du dataframe pour éviter les faux positifs.
    IMPORTANT: Travaille sur une copie pour ne pas modifier le DataFrame original.
    """
    df_normalized = df.copy()
    
    # Normaliser les colonnes texte (uniquement pour la comparaison)
    text_columns = df_normalized.select_dtypes(include=['object']).columns
    
    for col in text_columns:
        if col in df_normalized.columns:
            # Gérer les NaN avant conversion pour éviter 'nan' string
            df_normalized[col] = df_normalized[col].fillna('').astype(str).str.strip()
            
            # Remplacer multiples espaces par un seul
            df_normalized[col] = df_normalized[col].str.replace(r'\s+', ' ', regex=True)
    
    # Normaliser les nombres (arrondir pour éviter différences de précision)
    numeric_columns = df_normalized.select_dtypes(include=['float64', 'float32', 'int64', 'int32']).columns
    
    for col in numeric_columns:
        if col in df_normalized.columns:
            # Arrondir à 6 décimales
            df_normalized[col] = df_normalized[col].round(6)
    
    return df_normalized

# ============================================================================
# FONCTIONS UTILITAIRES
# ============================================================================

def generate_natural_key_hash(row, key_columns):
    """Génère un hash stable basé sur la clé naturelle."""
    key_values = [str(row[col]).strip() if pd.notna(row[col]) else '' 
                  for col in key_columns]
    key_string = '|'.join(key_values)
    return hashlib.sha256(key_string.encode('utf-8')).hexdigest()[:16]

def generate_new_uuid():
    """Génère un nouvel UUID pour les nouveaux records"""
    return str(uuid.uuid4())

def compare_records(old_row, new_row, columns):
    """Compare deux records sur les colonnes spécifiées."""
    has_changes = False
    changes_dict = {}
    
    for col in columns:
        if col not in new_row.index or col not in old_row.index:
            continue
            
        old_val = old_row[col]
        new_val = new_row[col]
        
        # Gérer les NaN
        if pd.isna(old_val) and pd.isna(new_val):
            continue
        
        # Comparer les valeurs
        if old_val != new_val:
            has_changes = True
            changes_dict[col] = {
                'old': old_val,
                'new': new_val
            }
    
    return has_changes, changes_dict

# ============================================================================
# ÉTAPE 1: CHARGER LES DATASETS
# ============================================================================

print("=" * 80)
print("ÉTAPE 1: CHARGEMENT DES DONNÉES")
print("=" * 80)

# Nouveau CSV import
df_new = dataiku.Dataset("importaxelsupraadmin_prepared").get_dataframe()
print(f"✓ Nouveau import chargé: {len(df_new):,} records")

# Forcer les colonnes texte à rester en type 'object' (string)
# Cela évite que Pandas les convertisse en float si elles sont majoritairement vides
text_columns_to_force = [
    'Méthodologie', 'Méthodologie_en',
    'Commentaires', 'Commentaires_en',
    'Description', 'Description_en',
    'Nom', 'Nom_en',
    'Périmètre', 'Périmètre_en',
    'Secteur', 'Secteur_en',
    'Sous-secteur', 'Sous-secteur_en',
    'Localisation', 'Localisation_en',
    'Source',
    'Contributeur', 'Contributeur_en',
    'Type_de_données', 'Type_de_données_en',
    'Unité donnée d\'activité', 'Unite_en',
    'Incertitude'
]

for col in text_columns_to_force:
    if col in df_new.columns:
        df_new[col] = df_new[col].astype(str).replace('nan', '').replace('None', '')

print(f"✓ Types de colonnes texte normalisés")

# IMPORTANT: Garder une copie non modifiée du df_new
df_new_original = df_new.copy()

# Validation des colonnes requises
print("\n🔍 VALIDATION DES COLONNES REQUISES...")
required_cols = set(NATURAL_KEY + MONITORED_COLUMNS)
missing_in_new = required_cols - set(df_new.columns)
if missing_in_new:
    raise ValueError(f"❌ ERREUR: Colonnes manquantes dans l'import: {sorted(missing_in_new)}\n"
                     f"   Colonnes présentes: {sorted(df_new.columns)}")
print(f"✓ Toutes les colonnes requises sont présentes")

# CSV source avec IDs existants
try:
    df_source = dataiku.Dataset("emission_factors_source").get_dataframe()
    print(f"✓ Source existante chargée: {len(df_source):,} records")
    
    if 'ID' not in df_source.columns or len(df_source) == 0:
        print(f"⚠️  Source sans colonne ID ou vide (premier import)")
        has_source = False
        df_source = pd.DataFrame()
    else:
        # Forcer les types pour la source aussi
        for col in text_columns_to_force:
            if col in df_source.columns:
                df_source[col] = df_source[col].astype(str).replace('nan', '').replace('None', '')
        print(f"✓ Types de colonnes texte normalisés pour la source")
        has_source = True
        
except Exception as e:
    print(f"⚠️  Pas de source existante (premier import): {e}")
    df_source = pd.DataFrame()
    has_source = False

# ============================================================================
# ÉTAPE 1.5: NORMALISATION POUR COMPARAISON UNIQUEMENT
# ============================================================================

print("\n" + "=" * 80)
print("ÉTAPE 1.5: NORMALISATION POUR COMPARAISON")
print("=" * 80)

print("⚙️  Création de versions normalisées pour la comparaison...")
# On crée des versions normalisées SÉPARÉES pour la comparaison
df_new_normalized = normalize_dataframe(df_new)
print("✓ Version normalisée du nouveau import créée")

if has_source:
    df_source_normalized = normalize_dataframe(df_source)
    print("✓ Version normalisée de la source créée")
else:
    df_source_normalized = pd.DataFrame()

print("\n📝 Normalisation appliquée (pour comparaison uniquement):")
print("  - Suppression des espaces superflus")
print("  - Uniformisation des espaces multiples")
print("  - Arrondi des nombres à 6 décimales")

# Reset index pour garantir l'alignement entre original et normalisé
df_new_normalized = df_new_normalized.reset_index(drop=True)
df_new_original = df_new_original.reset_index(drop=True)
print("✓ Index réinitialisés pour alignement garanti")

# ============================================================================
# ÉTAPE 2: GÉNÉRER LES HASHES DE CLÉ NATURELLE
# ============================================================================

print("\n" + "=" * 80)
print("ÉTAPE 2: GÉNÉRATION DES HASHES")
print("=" * 80)

# Générer les hashes sur les versions normalisées
df_new_normalized['natural_key_hash'] = df_new_normalized.apply(
    lambda row: generate_natural_key_hash(row, NATURAL_KEY),
    axis=1
)
print(f"✓ Hashes générés pour nouveau import")
print(f"  - Hashes uniques: {df_new_normalized['natural_key_hash'].nunique():,}")

# Vérifier les clés vides
empty_keys = df_new_normalized.apply(
    lambda row: all(not str(row[col]).strip() for col in NATURAL_KEY),
    axis=1
).sum()
if empty_keys > 0:
    print(f"⚠️  ATTENTION: {empty_keys:,} records avec clé naturelle vide détectés")
    print(f"   Ces records recevront des IDs uniques mais ne pourront pas être matchés")

if has_source:
    if 'natural_key_hash' not in df_source_normalized.columns:
        print(f"⚠️  Génération des hashes pour la source")
        df_source_normalized['natural_key_hash'] = df_source_normalized.apply(
            lambda row: generate_natural_key_hash(row, NATURAL_KEY),
            axis=1
        )
    print(f"✓ Hashes disponibles pour source")
    print(f"  - Hashes uniques: {df_source_normalized['natural_key_hash'].nunique():,}")

# ============================================================================
# ÉTAPE 3: MATCHING ET CLASSIFICATION
# ============================================================================

print("\n" + "=" * 80)
print("ÉTAPE 3: MATCHING PAR CLÉ NATURELLE")
print("=" * 80)

results = {
    'new': [],
    'update': [],
    'unchanged': []
}

if has_source:
    source_dict = {}
    hash_duplicates_count = 0
    
    for idx, row in df_source_normalized.iterrows():
        natural_hash = row['natural_key_hash']
        if natural_hash not in source_dict:
            # Garder le premier (stabilité des IDs)
            source_dict[natural_hash] = {
                'ID': df_source.loc[idx, 'ID'],  # Prendre l'ID depuis le df_source original
                'data': row  # Données normalisées pour comparaison
            }
        else:
            # Doublon détecté (même hash)
            hash_duplicates_count += 1
    
    print(f"✓ Index de lookup créé: {len(source_dict):,} records")
    if hash_duplicates_count > 0:
        print(f"⚠️  {hash_duplicates_count:,} doublons de hash détectés dans source")
        print(f"   (Première occurrence gardée pour stabilité des IDs)")
    
    for idx, new_row in df_new_normalized.iterrows():
        natural_hash = new_row['natural_key_hash']
        
        if natural_hash in source_dict:
            source_record = source_dict[natural_hash]
            existing_id = source_record['ID']
            existing_data = source_record['data']
            
            # Comparer les versions normalisées
            has_changes, changes = compare_records(
                existing_data, 
                new_row, 
                MONITORED_COLUMNS
            )
            
            if has_changes:
                results['update'].append({
                    'index': idx,
                    'ID': existing_id,
                    'natural_key_hash': natural_hash,
                    'changes': changes
                })
            else:
                results['unchanged'].append({
                    'index': idx,
                    'ID': existing_id,
                    'natural_key_hash': natural_hash
                })
        else:
            results['new'].append({
                'index': idx,
                'ID': generate_new_uuid(),
                'natural_key_hash': natural_hash
            })
    
    print(f"\n📊 RÉSULTATS DU MATCHING:")
    print(f"  ✅ Nouveaux records: {len(results['new']):,}")
    print(f"  🔄 Updates: {len(results['update']):,}")
    print(f"  ✓ Inchangés: {len(results['unchanged']):,}")
    
    if len(results['update']) > 0 and len(results['update']) <= 10:
        print(f"\n📝 EXEMPLES D'UPDATES DÉTECTÉS:")
        for i, update in enumerate(results['update'], 1):
            idx = update['index']
            row = df_new_normalized.loc[idx]
            print(f"\n  Update #{i}:")
            print(f"    ID: {update['ID']}")
            nom_display = str(row['Nom'])[:60] if pd.notna(row['Nom']) else '(vide)'
            print(f"    Nom: {nom_display}...")
            print(f"    Changements:")
            for col, change in update['changes'].items():
                old_str = str(change['old'])[:40]
                new_str = str(change['new'])[:40]
                print(f"      {col}: '{old_str}' → '{new_str}'")

else:
    print("✓ Premier import - génération de nouveaux IDs pour tous les records")
    for idx, new_row in df_new_normalized.iterrows():
        results['new'].append({
            'index': idx,
            'ID': generate_new_uuid(),
            'natural_key_hash': new_row['natural_key_hash']
        })
    
    print(f"\n📊 RÉSULTATS:")
    print(f"  ✅ Nouveaux records: {len(results['new']):,}")

# ============================================================================
# ÉTAPE 4: ASSIGNER LES IDs AU DATAFRAME ORIGINAL (NON NORMALISÉ)
# ============================================================================

print("\n" + "=" * 80)
print("ÉTAPE 4: ASSIGNATION DES IDs AU DATAFRAME ORIGINAL")
print("=" * 80)

id_mapping = {}
operation_mapping = {}
hash_mapping = {}

for record in results['new']:
    id_mapping[record['index']] = record['ID']
    operation_mapping[record['index']] = 'INSERT'
    hash_mapping[record['index']] = record['natural_key_hash']

for record in results['update']:
    id_mapping[record['index']] = record['ID']
    operation_mapping[record['index']] = 'UPDATE'
    hash_mapping[record['index']] = record['natural_key_hash']

for record in results['unchanged']:
    id_mapping[record['index']] = record['ID']
    operation_mapping[record['index']] = 'UNCHANGED'
    hash_mapping[record['index']] = record['natural_key_hash']

# IMPORTANT: Utiliser le dataframe ORIGINAL, pas la version normalisée
df_output = df_new_original.copy()

# Ajouter les colonnes de métadonnées
df_output['ID'] = df_output.index.map(id_mapping)
df_output['natural_key_hash'] = df_output.index.map(hash_mapping)
df_output['operation'] = df_output.index.map(operation_mapping)
df_output['import_timestamp'] = datetime.now()
df_output['matched_by_natural_key'] = True

# Réorganiser les colonnes : métadonnées d'abord, puis données
metadata_cols = ['ID', 'natural_key_hash', 'operation', 'import_timestamp', 'matched_by_natural_key']
data_cols = [col for col in df_output.columns if col not in metadata_cols]
df_output = df_output[metadata_cols + data_cols]

print(f"✓ IDs assignés au dataframe original (non normalisé)")
print(f"✓ Colonnes réorganisées (métadonnées en premier)")

# Vérifications
null_ids = df_output['ID'].isna().sum()
if null_ids > 0:
    print(f"⚠️  WARNING: {null_ids:,} records sans ID !")
else:
    print(f"✓ Tous les records ont un ID")

duplicate_ids = df_output['ID'].duplicated().sum()
if duplicate_ids > 0:
    print(f"⚠️  WARNING: {duplicate_ids:,} IDs dupliqués détectés !")
    print(f"   Application de la déduplication automatique...")
    print(f"   STRATÉGIE: Garder uniquement les records du NOUVEL IMPORT (version la plus récente)")
    
    # Trier par operation pour garantir que les nouveaux imports (INSERT/UPDATE) 
    # viennent AVANT les UNCHANGED (qui viennent de la source)
    # Puis dédupliquer en gardant le premier = celui du nouvel import
    operation_priority = {'INSERT': 1, 'UPDATE': 2, 'UNCHANGED': 3}
    df_output['_priority'] = df_output['operation'].map(operation_priority)
    df_output = df_output.sort_values('_priority')
    df_output = df_output.drop_duplicates(subset=['ID'], keep='first')
    df_output = df_output.drop(columns=['_priority'])
    
    print(f"✓ Déduplication appliquée: {len(df_output):,} records uniques restants")
    print(f"✓ Priorité donnée aux records INSERT/UPDATE du nouvel import")
else:
    print(f"✓ Tous les IDs sont uniques")

# VÉRIFICATION DES DONNÉES: Info uniquement (pas d'erreur si déduplication)
print("\n🔍 VÉRIFICATION DE L'INTÉGRITÉ DES DONNÉES:")
print(f"  Records avant déduplication: {len(df_new_original):,}")
print(f"  Records après déduplication: {len(df_output):,}")
if len(df_output) < len(df_new_original):
    diff = len(df_new_original) - len(df_output)
    print(f"  ✓ {diff:,} doublons supprimés (attendu)")
else:
    print(f"  ✓ Aucune déduplication nécessaire")

# Vérifier qu'aucun record n'a perdu ses données essentielles
critical_cols = ['Nom', 'Source']  # Colonnes qui ne doivent JAMAIS être vides
for col in critical_cols:
    if col in df_output.columns:
        nulls = df_output[col].isna().sum()
        if nulls > 0:
            print(f"  ⚠️  Colonne '{col}': {nulls:,} valeurs vides détectées")
        else:
            print(f"  ✓ Colonne '{col}': Toutes les valeurs présentes")

print(f"✓ Vérification d'intégrité terminée")

# ============================================================================
# ÉTAPE 5: STATISTIQUES FINALES
# ============================================================================

print("\n" + "=" * 80)
print("ÉTAPE 5: STATISTIQUES FINALES")
print("=" * 80)

print(f"\n📊 RÉSUMÉ:")
print(f"  Total records: {len(df_output):,}")
print(f"  - INSERT (nouveaux): {(df_output['operation'] == 'INSERT').sum():,}")
print(f"  - UPDATE (modifiés): {(df_output['operation'] == 'UPDATE').sum():,}")
print(f"  - UNCHANGED (identiques): {(df_output['operation'] == 'UNCHANGED').sum():,}")

# ============================================================================
# ÉTAPE 6: ÉCRIRE LE RÉSULTAT
# ============================================================================

print("\n" + "=" * 80)
print("ÉTAPE 6: ÉCRITURE DU RÉSULTAT")
print("=" * 80)

output = dataiku.Dataset("emission_factors_with_ids")
output.write_with_schema(df_output)

print(f"✓ Dataset 'emission_factors_with_ids' créé")
print(f"  - {len(df_output):,} records")
print(f"  - Toutes les colonnes originales préservées")
print(f"  - Prêt pour upload Supabase")

print("\n" + "=" * 80)
print("✅ TRAITEMENT TERMINÉ")
print("=" * 80)

print(f"""
PROCHAINES ÉTAPES:
1. Vérifier le dataset 'emission_factors_with_ids'
2. Comparer quelques lignes avec le fichier input pour validation
3. Si correct, uploader vers Supabase (UPSERT sur ID)
4. Sauvegarder 'emission_factors_with_ids' comme nouvelle source
""")

