#!/bin/bash

# Script pour monitorer les logs Edge Function en temps réel
# À lancer pendant que vous faites des hard refresh sur localhost:8082/search

echo "🔍 Monitoring des logs Edge Function (v122)"
echo "=============================================="
echo ""
echo "Instructions:"
echo "1. Laissez ce script tourner"
echo "2. Allez sur http://localhost:8082/search"
echo "3. Faites 5-6 hard refresh (Cmd+Shift+R)"
echo "4. Observez les logs ci-dessous"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter"
echo ""
echo "--- LOGS EN TEMPS RÉEL ---"
echo ""

# Boucle pour récupérer les logs toutes les 2 secondes
while true; do
  npx supabase functions logs algolia-search-proxy --limit 20 2>/dev/null | grep -A 2 "FACET DEBUG" || true
  sleep 2
done

