#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Test: Vérification de l'Intégrité des Données Dataiku
================================================================

Ce script compare le fichier INPUT avec le fichier OUTPUT
pour détecter toute perte de données.

Usage:
    python test_dataiku_integrity.py <input_file> <output_file>

Exemple:
    python test_dataiku_integrity.py export_algolia_COMBINED.csv emission_factors_with_ids.csv
"""

import sys
import pandas as pd
from pathlib import Path

def test_integrity(input_file, output_file):
    """
    Compare les deux fichiers et détecte les pertes de données.
    """
    print("=" * 80)
    print("TEST D'INTÉGRITÉ DES DONNÉES DATAIKU")
    print("=" * 80)
    
    # Charger les fichiers
    print(f"\n📂 Chargement des fichiers...")
    print(f"  INPUT : {input_file}")
    print(f"  OUTPUT: {output_file}")
    
    try:
        df_input = pd.read_csv(input_file, low_memory=False)
        print(f"  ✓ INPUT chargé: {len(df_input):,} lignes, {len(df_input.columns)} colonnes")
    except Exception as e:
        print(f"  ❌ ERREUR lors du chargement de INPUT: {e}")
        return False
    
    try:
        df_output = pd.read_csv(output_file, low_memory=False)
        print(f"  ✓ OUTPUT chargé: {len(df_output):,} lignes, {len(df_output.columns)} colonnes")
    except Exception as e:
        print(f"  ❌ ERREUR lors du chargement de OUTPUT: {e}")
        return False
    
    # Tests
    all_tests_passed = True
    
    # TEST 1: Nombre de lignes
    print("\n" + "=" * 80)
    print("TEST 1: NOMBRE DE LIGNES")
    print("=" * 80)
    
    if len(df_input) == len(df_output):
        print(f"✅ PASS: {len(df_input):,} lignes (identique)")
    else:
        print(f"❌ FAIL: INPUT={len(df_input):,}, OUTPUT={len(df_output):,}")
        all_tests_passed = False
    
    # TEST 2: Colonnes préservées
    print("\n" + "=" * 80)
    print("TEST 2: COLONNES PRÉSERVÉES")
    print("=" * 80)
    
    input_cols = set(df_input.columns)
    output_cols = set(df_output.columns)
    
    missing_cols = input_cols - output_cols
    if len(missing_cols) == 0:
        print(f"✅ PASS: Toutes les colonnes INPUT sont dans OUTPUT")
    else:
        print(f"❌ FAIL: Colonnes manquantes dans OUTPUT:")
        for col in sorted(missing_cols):
            print(f"  - {col}")
        all_tests_passed = False
    
    # Colonnes ajoutées (attendu)
    expected_new_cols = {'natural_key_hash', 'operation', 'import_timestamp', 'matched_by_natural_key'}
    new_cols = output_cols - input_cols
    unexpected_cols = new_cols - expected_new_cols
    
    if len(unexpected_cols) == 0:
        print(f"✅ PASS: Colonnes ajoutées sont celles attendues")
        print(f"  Ajoutées: {', '.join(sorted(new_cols))}")
    else:
        print(f"⚠️  WARNING: Colonnes inattendues ajoutées:")
        for col in sorted(unexpected_cols):
            print(f"  - {col}")
    
    # TEST 3: Valeurs nulles par colonne (colonnes communes)
    print("\n" + "=" * 80)
    print("TEST 3: VALEURS NULLES (colonnes communes)")
    print("=" * 80)
    
    common_cols = input_cols.intersection(output_cols)
    
    cols_with_diff = []
    for col in sorted(common_cols):
        nulls_input = df_input[col].isna().sum()
        nulls_output = df_output[col].isna().sum()
        
        if nulls_input != nulls_output:
            cols_with_diff.append({
                'column': col,
                'input_nulls': nulls_input,
                'output_nulls': nulls_output,
                'diff': nulls_output - nulls_input
            })
    
    if len(cols_with_diff) == 0:
        print(f"✅ PASS: Aucune différence de valeurs nulles")
    else:
        print(f"❌ FAIL: Différences détectées dans {len(cols_with_diff)} colonnes:")
        for item in cols_with_diff:
            print(f"\n  Colonne: {item['column']}")
            print(f"    INPUT : {item['input_nulls']:,} nulls")
            print(f"    OUTPUT: {item['output_nulls']:,} nulls")
            print(f"    DIFF  : {item['diff']:+,} (négatif = perte)")
            
            if item['diff'] > 0:
                print(f"    ⚠️  PERTE DE DONNÉES: {item['diff']} valeurs devenues nulles")
        
        all_tests_passed = False
    
    # TEST 4: Colonnes critiques (FE, Nom, etc.)
    print("\n" + "=" * 80)
    print("TEST 4: COLONNES CRITIQUES")
    print("=" * 80)
    
    critical_cols = ['FE', 'Nom', 'Source', 'Date', 'Périmètre']
    
    for col in critical_cols:
        if col not in df_input.columns:
            print(f"⚠️  SKIP: Colonne '{col}' absente dans INPUT")
            continue
        
        if col not in df_output.columns:
            print(f"❌ FAIL: Colonne '{col}' absente dans OUTPUT")
            all_tests_passed = False
            continue
        
        # Comparer les premières lignes
        sample_size = min(10, len(df_input))
        differences = 0
        
        for i in range(sample_size):
            val_input = df_input.loc[i, col]
            val_output = df_output.loc[i, col]
            
            # Gérer les NaN
            if pd.isna(val_input) and pd.isna(val_output):
                continue
            
            if val_input != val_output:
                differences += 1
        
        if differences == 0:
            print(f"✅ PASS: Colonne '{col}' - échantillon OK ({sample_size} lignes testées)")
        else:
            print(f"❌ FAIL: Colonne '{col}' - {differences}/{sample_size} différences détectées")
            all_tests_passed = False
    
    # TEST 5: Types de données
    print("\n" + "=" * 80)
    print("TEST 5: TYPES DE DONNÉES")
    print("=" * 80)
    
    type_changes = []
    for col in common_cols:
        type_input = str(df_input[col].dtype)
        type_output = str(df_output[col].dtype)
        
        if type_input != type_output:
            type_changes.append({
                'column': col,
                'input_type': type_input,
                'output_type': type_output
            })
    
    if len(type_changes) == 0:
        print(f"✅ PASS: Tous les types de données sont préservés")
    else:
        print(f"⚠️  WARNING: {len(type_changes)} colonnes ont changé de type:")
        for item in type_changes:
            print(f"  {item['column']}: {item['input_type']} → {item['output_type']}")
    
    # TEST 6: IDs uniques dans OUTPUT
    print("\n" + "=" * 80)
    print("TEST 6: UNICITÉ DES IDs (OUTPUT)")
    print("=" * 80)
    
    if 'ID' in df_output.columns:
        total_ids = len(df_output)
        unique_ids = df_output['ID'].nunique()
        null_ids = df_output['ID'].isna().sum()
        duplicate_ids = total_ids - unique_ids - null_ids
        
        print(f"  Total IDs     : {total_ids:,}")
        print(f"  IDs uniques   : {unique_ids:,}")
        print(f"  IDs null      : {null_ids:,}")
        print(f"  IDs dupliqués : {duplicate_ids:,}")
        
        if null_ids == 0 and duplicate_ids == 0:
            print(f"✅ PASS: Tous les IDs sont valides et uniques")
        else:
            if null_ids > 0:
                print(f"❌ FAIL: {null_ids} IDs null détectés")
                all_tests_passed = False
            if duplicate_ids > 0:
                print(f"❌ FAIL: {duplicate_ids} IDs dupliqués détectés")
                all_tests_passed = False
    else:
        print(f"⚠️  SKIP: Colonne 'ID' absente dans OUTPUT")
    
    # RÉSULTAT FINAL
    print("\n" + "=" * 80)
    print("RÉSULTAT FINAL")
    print("=" * 80)
    
    if all_tests_passed:
        print("✅ TOUS LES TESTS SONT PASSÉS")
        print("   Les données sont intègres, le fichier OUTPUT est valide.")
        return True
    else:
        print("❌ CERTAINS TESTS ONT ÉCHOUÉ")
        print("   Vérifier les erreurs ci-dessus avant de continuer.")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python test_dataiku_integrity.py <input_file> <output_file>")
        print("\nExemple:")
        print("  python test_dataiku_integrity.py export_algolia.csv emission_factors_with_ids.csv")
        sys.exit(1)
    
    input_file = Path(sys.argv[1])
    output_file = Path(sys.argv[2])
    
    if not input_file.exists():
        print(f"❌ ERREUR: Fichier INPUT introuvable: {input_file}")
        sys.exit(1)
    
    if not output_file.exists():
        print(f"❌ ERREUR: Fichier OUTPUT introuvable: {output_file}")
        sys.exit(1)
    
    success = test_integrity(input_file, output_file)
    
    sys.exit(0 if success else 1)

