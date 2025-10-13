#!/bin/bash

# Script de nettoyage des branches Git
# Garde uniquement main et staging

echo "🧹 Nettoyage des branches Git..."
echo ""

# Branches à garder
KEEP_BRANCHES=("main" "staging")

# Se positionner sur main
git checkout main

echo "📋 Branches locales à supprimer:"
git branch | grep -v "main" | grep -v "staging" | grep -v "\*"

echo ""
read -p "Voulez-vous supprimer toutes ces branches locales ? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    # Supprimer toutes les branches locales sauf main et staging
    git branch | grep -v "main" | grep -v "staging" | grep -v "\*" | xargs -r git branch -D
    echo "✅ Branches locales supprimées"
fi

echo ""
echo "📋 Branches distantes à supprimer:"
git branch -r | grep -v "origin/main" | grep -v "origin/staging" | grep -v "origin/HEAD" | sed 's/origin\///'

echo ""
read -p "Voulez-vous supprimer toutes ces branches distantes ? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    # Supprimer toutes les branches distantes sauf main et staging
    git branch -r | grep -v "origin/main" | grep -v "origin/staging" | grep -v "origin/HEAD" | sed 's/origin\///' | xargs -I {} git push origin --delete {}
    echo "✅ Branches distantes supprimées"
fi

echo ""
echo "🎉 Nettoyage terminé !"
echo ""
echo "Branches restantes:"
git branch -a | grep -E "(main|staging)"




