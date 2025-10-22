#!/bin/bash

# Script d'automatisation pour ajouter un document à l'historique
# Usage: ./scripts/add-to-history.sh <fichier.md> "<description>"

set -e

# Couleurs pour les messages
RED='\033[0:31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifications
if [ $# -ne 2 ]; then
    echo -e "${RED}❌ Usage: ./scripts/add-to-history.sh <fichier.md> \"<description>\"${NC}"
    echo -e "${YELLOW}Exemple: ./scripts/add-to-history.sh RAPPORT_ANALYSE.md \"Analyse complète du système\"${NC}"
    exit 1
fi

FILE=$1
DESCRIPTION=$2

# Vérifier que le fichier existe
if [ ! -f "$FILE" ]; then
    echo -e "${RED}❌ Le fichier $FILE n'existe pas${NC}"
    exit 1
fi

# Vérifier que c'est bien un fichier .md
if [[ ! $FILE =~ \.md$ ]]; then
    echo -e "${RED}❌ Le fichier doit être un fichier Markdown (.md)${NC}"
    exit 1
fi

# Obtenir la date du jour
DATE=$(date +%Y-%m-%d)

# Extraire le nom du fichier sans le chemin
BASENAME=$(basename "$FILE")

# Créer le nouveau nom avec la date
NEW_NAME="${DATE}_${BASENAME}"

# Vérifier si le fichier existe déjà dans docs/history/
if [ -f "docs/history/$NEW_NAME" ]; then
    echo -e "${YELLOW}⚠️  Le fichier docs/history/$NEW_NAME existe déjà${NC}"
    read -p "Voulez-vous le remplacer ? (o/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Oo]$ ]]; then
        echo -e "${RED}❌ Opération annulée${NC}"
        exit 1
    fi
fi

# Déplacer le fichier
mv "$FILE" "docs/history/$NEW_NAME"
echo -e "${GREEN}✅ Fichier déplacé vers docs/history/$NEW_NAME${NC}"

# Mettre à jour CHANGELOG.md
echo -e "${YELLOW}📝 Mise à jour du CHANGELOG.md...${NC}"

# Extraire la version actuelle du CHANGELOG
CURRENT_VERSION=$(grep -m 1 "^## \[" CHANGELOG.md | sed 's/## \[\(.*\)\].*/\1/')

# Créer une entrée temporaire
TEMP_ENTRY="### $(date +%Y-%m-%d)\n- **${BASENAME}** : ${DESCRIPTION}\n  - Documentation complète dans \`docs/history/$NEW_NAME\`\n"

# Chercher la ligne "## [Non publié]" et ajouter après
sed -i '' "/## \[Non publié\]/a\\
\\
$TEMP_ENTRY
" CHANGELOG.md

echo -e "${GREEN}✅ CHANGELOG.md mis à jour${NC}"

# Mettre à jour docs/history/INDEX.md
echo -e "${YELLOW}📝 Mise à jour de docs/history/INDEX.md...${NC}"

# Déterminer la catégorie basée sur le nom du fichier
CATEGORY="📊 Rapport"
if [[ $BASENAME =~ ^HOTFIX ]]; then
    CATEGORY="🐛 Hotfix"
elif [[ $BASENAME =~ ^OPTIMISATION ]]; then
    CATEGORY="⚡ Optimisation"
elif [[ $BASENAME =~ ^FEATURE ]]; then
    CATEGORY="🎯 Feature"
elif [[ $BASENAME =~ ^MIGRATION ]]; then
    CATEGORY="📦 Migration"
elif [[ $BASENAME =~ ^TEST ]]; then
    CATEGORY="🧪 Tests"
elif [[ $BASENAME =~ ^PHASE ]]; then
    CATEGORY="🎯 Feature"
fi

# Ajouter au INDEX.md après la section "## 2025-XX"
YEAR_MONTH=$(date +%Y-%m)
INDEX_ENTRY="- **${NEW_NAME}** - ${DESCRIPTION}"

# Chercher la section du mois en cours
if ! grep -q "### $DATE" docs/history/INDEX.md; then
    # Ajouter la section si elle n'existe pas
    sed -i '' "/## $YEAR_MONTH/a\\
\\
### $DATE $CATEGORY\\
$INDEX_ENTRY
" docs/history/INDEX.md
else
    # Ajouter à la section existante
    sed -i '' "/### $DATE/a\\
$INDEX_ENTRY
" docs/history/INDEX.md
fi

echo -e "${GREEN}✅ docs/history/INDEX.md mis à jour${NC}"

# Mettre à jour les statistiques dans INDEX.md
echo -e "${YELLOW}📊 Mise à jour des statistiques...${NC}"

TOTAL_DOCS=$(find docs/history -name "*.md" ! -name "INDEX.md" | wc -l | tr -d ' ')
sed -i '' "s/\*\*Total de documents indexés\*\* : [0-9]*/\*\*Total de documents indexés\*\* : $TOTAL_DOCS/" docs/history/INDEX.md

echo -e "${GREEN}✅ Statistiques mises à jour (Total: $TOTAL_DOCS documents)${NC}"

# Résumé
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Opération terminée avec succès !${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo -e "Fichier ajouté : ${GREEN}docs/history/$NEW_NAME${NC}"
echo -e "Description    : ${DESCRIPTION}"
echo -e "Date           : ${DATE}"
echo -e "Catégorie      : ${CATEGORY}"
echo ""
echo -e "${YELLOW}N'oubliez pas de :${NC}"
echo -e "  1. Vérifier les modifications dans CHANGELOG.md"
echo -e "  2. Vérifier les modifications dans docs/history/INDEX.md"
echo -e "  3. Commit les changements : ${GREEN}git add . && git commit -m \"docs: ajout de $BASENAME à l'historique\"${NC}"
echo ""


