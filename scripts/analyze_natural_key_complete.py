#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Analyse Complète de la Clé Naturelle - Fichier Export Algolia
==============================================================

Objectif : Déterminer la combinaison optimale de colonnes pour la clé naturelle
en analysant le fichier complet.
"""

import sys
import hashlib
from collections import defaultdict

def generate_hash(row_dict, key_columns):
    """Génère un hash basé sur les colonnes spécifiées."""
    key_values = [str(row_dict.get(col, '')).strip() for col in key_columns]
    key_string = '|'.join(key_values)
    return hashlib.sha256(key_string.encode('utf-8')).hexdigest()[:16]

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
    
    values.append(current_value)  # Dernière valeur
    
    # Créer dictionnaire
    row_dict = {}
    for i, header in enumerate(headers):
        if i < len(values):
            row_dict[header] = values[i].strip()
    
    return row_dict

def analyze_natural_key(file_path, sample_size=None):
    """
    Analyse différentes combinaisons de clés naturelles.
    """
    print("=" * 80)
    print("ANALYSE COMPLÈTE DE LA CLÉ NATURELLE")
    print("=" * 80)
    print(f"\nFichier: {file_path}")
    
    # Ouvrir le fichier
    with open(file_path, 'r', encoding='utf-8') as f:
        # Lire header
        header_line = f.readline().strip()
        headers = [h.strip() for h in header_line.split(',')]
        
        print(f"\n📋 COLONNES DISPONIBLES ({len(headers)}):")
        for i, h in enumerate(headers, 1):
            print(f"  {i:2d}. {h}")
        
        # Définir les combinaisons de clés à tester
        key_combinations = {
            'Actuelle': ['Nom', 'Périmètre', 'Localisation', 'Source', 'Date'],
            'Sans Périmètre': ['Nom', 'Localisation', 'Source', 'Date'],
            'Avec Secteur': ['Nom', 'Périmètre', 'Localisation', 'Source', 'Date', 'Secteur'],
            'Minimale': ['Nom', 'Périmètre', 'Date'],
            'Avec Sous-secteur': ['Nom', 'Périmètre', 'Localisation', 'Source', 'Date', 'Sous-secteur'],
        }
        
        print(f"\n🔍 COMBINAISONS À TESTER:")
        for i, (name, cols) in enumerate(key_combinations.items(), 1):
            print(f"\n  {i}. {name}:")
            print(f"     Colonnes: {cols}")
        
        # Structures de données pour chaque combinaison
        results = {}
        for combo_name in key_combinations:
            results[combo_name] = {
                'hashes': set(),
                'duplicates': defaultdict(list),
                'total_records': 0
            }
        
        # Lire et analyser ligne par ligne
        print(f"\n⏳ ANALYSE EN COURS...")
        line_count = 0
        
        for line in f:
            line_count += 1
            
            if line_count % 50000 == 0:
                print(f"  Traitement: {line_count:,} lignes...")
            
            # Limite optionnelle pour tests rapides
            if sample_size and line_count > sample_size:
                break
            
            # Parser la ligne
            row_dict = parse_csv_line(line, headers)
            
            # Tester chaque combinaison
            for combo_name, key_cols in key_combinations.items():
                # Vérifier que les colonnes existent
                if all(col in row_dict for col in key_cols):
                    hash_val = generate_hash(row_dict, key_cols)
                    
                    result = results[combo_name]
                    result['total_records'] += 1
                    
                    # Détecter doublons
                    if hash_val in result['hashes']:
                        # Stocker info du doublon
                        result['duplicates'][hash_val].append({
                            'line': line_count,
                            'Nom': row_dict.get('Nom', '')[:50],
                            'Périmètre': row_dict.get('Périmètre', ''),
                            'FE': row_dict.get('FE', ''),
                            'Secteur': row_dict.get('Secteur', '')[:30]
                        })
                    else:
                        result['hashes'].add(hash_val)
        
        print(f"\n✓ Analyse terminée: {line_count:,} lignes analysées")
        
        # Afficher les résultats
        print("\n" + "=" * 80)
        print("RÉSULTATS DE L'ANALYSE")
        print("=" * 80)
        
        best_combo = None
        best_uniqueness = 0
        
        for combo_name, key_cols in key_combinations.items():
            result = results[combo_name]
            total = result['total_records']
            unique = len(result['hashes'])
            duplicates_count = total - unique
            uniqueness = (unique / total * 100) if total > 0 else 0
            
            print(f"\n{'=' * 80}")
            print(f"COMBINAISON: {combo_name}")
            print(f"{'=' * 80}")
            print(f"Colonnes: {', '.join(key_cols)}")
            print(f"\n📊 STATISTIQUES:")
            print(f"  Total records       : {total:,}")
            print(f"  Hashes uniques      : {unique:,}")
            print(f"  Doublons (même hash): {duplicates_count:,}")
            print(f"  Taux d'unicité      : {uniqueness:.2f}%")
            
            # Meilleure combinaison
            if uniqueness > best_uniqueness:
                best_uniqueness = uniqueness
                best_combo = combo_name
            
            # Afficher exemples de doublons
            if duplicates_count > 0:
                print(f"\n📝 EXEMPLES DE DOUBLONS (Top 5):")
                sorted_dupes = sorted(
                    result['duplicates'].items(), 
                    key=lambda x: len(x[1]), 
                    reverse=True
                )[:5]
                
                for i, (hash_val, dupes) in enumerate(sorted_dupes, 1):
                    print(f"\n  Doublon #{i}: Hash {hash_val} ({len(dupes)} occurrences)")
                    for dupe in dupes[:3]:  # Montrer max 3 exemples
                        print(f"    Ligne {dupe['line']}:")
                        print(f"      Nom: {dupe['Nom']}")
                        print(f"      Périmètre: {dupe['Périmètre']}")
                        print(f"      FE: {dupe['FE']}")
            else:
                print(f"\n✅ Aucun doublon détecté - Clé parfaite !")
        
        # Recommandation finale
        print("\n" + "=" * 80)
        print("RECOMMANDATION FINALE")
        print("=" * 80)
        print(f"\n🏆 MEILLEURE COMBINAISON: {best_combo}")
        print(f"   Taux d'unicité: {best_uniqueness:.2f}%")
        print(f"   Colonnes: {key_combinations[best_combo]}")
        
        # Analyse comparative
        print(f"\n📊 COMPARAISON:")
        sorted_results = sorted(
            [(name, (len(results[name]['hashes']) / results[name]['total_records'] * 100) if results[name]['total_records'] > 0 else 0)
             for name in key_combinations.keys()],
            key=lambda x: x[1],
            reverse=True
        )
        
        for i, (name, uniqueness) in enumerate(sorted_results, 1):
            marker = "👑" if name == best_combo else "  "
            print(f"  {marker} {i}. {name:20s}: {uniqueness:6.2f}%")
        
        # Conclusion
        print(f"\n💡 CONCLUSION:")
        actuelle_uniqueness = (len(results['Actuelle']['hashes']) / results['Actuelle']['total_records'] * 100) if results['Actuelle']['total_records'] > 0 else 0
        
        if best_combo == 'Actuelle':
            print(f"   ✅ La clé naturelle actuelle est optimale !")
            print(f"   → Garder: {key_combinations['Actuelle']}")
        else:
            improvement = best_uniqueness - actuelle_uniqueness
            print(f"   ⚠️  La clé '{best_combo}' est meilleure (+{improvement:.2f}%)")
            print(f"   → Recommandation: Changer pour {key_combinations[best_combo]}")
        
        return results, best_combo

if __name__ == "__main__":
    file_path = "/Users/axelgirard/Downloads/export_algolia_COMBINED_2025-10-14_13-21.csv"
    
    # Analyser tout le fichier (ou avec sample_size=10000 pour test rapide)
    analyze_natural_key(file_path, sample_size=None)

