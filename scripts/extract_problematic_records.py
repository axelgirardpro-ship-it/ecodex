#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extraction des Records Problématiques
======================================

Objectif : Identifier et exporter tous les records avec problèmes dans un CSV
"""

import csv
import hashlib
from collections import defaultdict
from datetime import datetime

def generate_hash(row_dict, key_columns):
    """Génère un hash basé sur les colonnes spécifiées."""
    key_values = [str(row_dict.get(col, '')).strip() for col in key_columns]
    key_string = '|'.join(key_values)
    return hashlib.sha256(key_string.encode('utf-8')).hexdigest()[:16]

def is_empty_natural_key(row_dict, key_columns):
    """Vérifie si toutes les colonnes de la clé naturelle sont vides."""
    return all(not str(row_dict.get(col, '')).strip() for col in key_columns)

def parse_csv_line(line, headers):
    """Parse une ligne CSV en tenant compte des guillemets."""
    values = []
    current_value = ""
    in_quotes = False
    
    for char in line:
        if char == '"':
            in_quotes = not in_quotes
        elif char == ',' and not in_quotes:
            values.append(current_value)
            current_value = ""
        else:
            current_value += char
    
    values.append(current_value)
    
    row_dict = {}
    for i, header in enumerate(headers):
        if i < len(values):
            row_dict[header] = values[i].strip()
        else:
            row_dict[header] = ''
    
    return row_dict

def extract_problematic_records(input_file, output_file):
    """
    Extrait tous les records problématiques dans un CSV.
    """
    print("=" * 80)
    print("EXTRACTION DES RECORDS PROBLÉMATIQUES")
    print("=" * 80)
    print(f"\nFichier source: {input_file}")
    print(f"Fichier sortie: {output_file}")
    
    NATURAL_KEY = ['Nom', 'Périmètre', 'Localisation', 'Source', 'Date']
    
    # Structures pour détecter les problèmes
    hash_records = defaultdict(list)
    empty_key_records = []
    
    print(f"\n⏳ Analyse en cours...")
    
    with open(input_file, 'r', encoding='utf-8') as f:
        header_line = f.readline().strip()
        headers = [h.strip() for h in header_line.split(',')]
        
        line_num = 1  # Ligne 1 = header
        
        for line in f:
            line_num += 1
            
            if line_num % 50000 == 0:
                print(f"  Traité: {line_num:,} lignes...")
            
            row_dict = parse_csv_line(line, headers)
            row_dict['_line_number'] = line_num
            row_dict['_original_line'] = line.strip()
            
            # Problème 1: Clé naturelle vide
            if is_empty_natural_key(row_dict, NATURAL_KEY):
                row_dict['_problem_type'] = 'EMPTY_KEY'
                row_dict['_problem_description'] = 'Toutes les colonnes de la clé naturelle sont vides'
                empty_key_records.append(row_dict)
                continue
            
            # Problème 2: Doublons (même hash)
            hash_val = generate_hash(row_dict, NATURAL_KEY)
            hash_records[hash_val].append(row_dict)
    
    print(f"✓ Analyse terminée: {line_num:,} lignes")
    
    # Identifier les doublons
    print(f"\n🔍 IDENTIFICATION DES PROBLÈMES...")
    
    duplicate_records = []
    for hash_val, records in hash_records.items():
        if len(records) > 1:
            # Marquer tous sauf le premier comme doublons
            for i, record in enumerate(records):
                if i > 0:  # Garder le premier, marquer les autres
                    record['_problem_type'] = 'DUPLICATE'
                    record['_problem_description'] = f'Doublon de hash {hash_val} (occurrence {i+1}/{len(records)})'
                    record['_first_occurrence_line'] = records[0]['_line_number']
                    duplicate_records.append(record)
    
    # Statistiques
    total_problems = len(empty_key_records) + len(duplicate_records)
    
    print(f"\n📊 STATISTIQUES:")
    print(f"  Total lignes analysées: {line_num:,}")
    print(f"  Records avec clé vide : {len(empty_key_records):,}")
    print(f"  Records en doublon    : {len(duplicate_records):,}")
    print(f"  Total problématiques  : {total_problems:,}")
    print(f"  Pourcentage           : {(total_problems/line_num*100):.2f}%")
    
    if total_problems == 0:
        print(f"\n✅ Aucun record problématique détecté !")
        return
    
    # Écrire le CSV de sortie
    print(f"\n💾 ÉCRITURE DU FICHIER CSV...")
    
    all_problems = empty_key_records + duplicate_records
    
    # Colonnes pour le CSV de sortie
    output_headers = [
        '_line_number',
        '_problem_type',
        '_problem_description',
        '_first_occurrence_line'
    ] + NATURAL_KEY + [
        'FE',
        'ID',
        'Secteur',
        'Sous-secteur',
        'Incertitude',
        'Description'
    ]
    
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=output_headers, extrasaction='ignore')
        writer.writeheader()
        
        for record in sorted(all_problems, key=lambda x: x['_line_number']):
            writer.writerow(record)
    
    print(f"✓ Fichier créé: {output_file}")
    print(f"  {len(all_problems):,} records problématiques exportés")
    
    # Résumé par type de problème
    print(f"\n📋 RÉSUMÉ PAR TYPE:")
    print(f"  1. CLÉ VIDE ({len(empty_key_records):,} records)")
    if len(empty_key_records) > 0:
        print(f"     Lignes: {min(r['_line_number'] for r in empty_key_records)} à {max(r['_line_number'] for r in empty_key_records)}")
    
    print(f"\n  2. DOUBLONS ({len(duplicate_records):,} records)")
    if len(duplicate_records) > 0:
        # Grouper par hash
        hash_groups = defaultdict(list)
        for r in duplicate_records:
            hash_val = generate_hash(r, NATURAL_KEY)
            hash_groups[hash_val].append(r)
        
        sorted_groups = sorted(hash_groups.items(), key=lambda x: len(x[1]), reverse=True)[:5]
        print(f"     Top 5 groupes de doublons:")
        for i, (hash_val, records) in enumerate(sorted_groups, 1):
            first = records[0]
            nom = first.get('Nom', '')[:40]
            print(f"       {i}. Hash {hash_val}: {len(records)} doublons - Nom: {nom}...")
    
    # Recommandations
    print(f"\n💡 RECOMMANDATIONS:")
    
    if len(empty_key_records) > 0:
        print(f"\n  CLÉ VIDE:")
        print(f"    → Ces {len(empty_key_records):,} lignes ont toutes les colonnes de clé vides")
        print(f"    → Options:")
        print(f"       1. Supprimer ces lignes (recommandé)")
        print(f"       2. Corriger manuellement les données manquantes")
    
    if len(duplicate_records) > 0:
        print(f"\n  DOUBLONS:")
        print(f"    → {len(duplicate_records):,} doublons détectés")
        print(f"    → Le code Dataiku garde automatiquement la première occurrence")
        print(f"    → Options:")
        print(f"       1. Laisser le code gérer (première occurrence gardée)")
        print(f"       2. Nettoyer manuellement en supprimant les doublons")
        print(f"       3. Ajouter une colonne à la clé naturelle pour les différencier")
    
    print(f"\n" + "=" * 80)
    print("✅ EXTRACTION TERMINÉE")
    print("=" * 80)
    print(f"\nConsultez le fichier: {output_file}")

if __name__ == "__main__":
    input_file = "/Users/axelgirard/Downloads/export_algolia_COMBINED_2025-10-14_13-21.csv"
    
    # Nom du fichier de sortie avec timestamp
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = f"/Users/axelgirard/Downloads/records_problematiques_{timestamp}.csv"
    
    extract_problematic_records(input_file, output_file)
    
    print(f"\n📊 POUR ANALYSER:")
    print(f"   Ouvrir le fichier dans Excel/LibreOffice:")
    print(f"   {output_file}")

