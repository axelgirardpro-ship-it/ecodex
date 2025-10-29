#!/bin/bash

echo "🚀 Test complet de la fonction Edge en local"
echo "============================================"
echo ""

# Étape 1 : Copier le fichier env
echo "📋 Étape 1 : Configuration des secrets..."
cp supabase/env.template supabase/.env
echo "✅ Fichier .env créé"
echo ""

# Étape 2 : Lancer la fonction en arrière-plan
echo "🔧 Étape 2 : Démarrage de la fonction Edge..."
supabase functions serve llamacloud-chat-proxy --env-file supabase/.env --no-verify-jwt > /tmp/edge-function-logs.txt 2>&1 &
FUNCTION_PID=$!
echo "✅ Fonction démarrée (PID: $FUNCTION_PID)"
echo "⏳ Attente de 5 secondes pour le démarrage..."
sleep 5
echo ""

# Étape 3 : Vérifier que la fonction tourne
if ! kill -0 $FUNCTION_PID 2>/dev/null; then
    echo "❌ Erreur : La fonction ne s'est pas lancée correctement"
    echo "📋 Logs :"
    cat /tmp/edge-function-logs.txt
    exit 1
fi
echo "✅ Fonction prête"
echo ""

# Étape 4 : Appeler la fonction
echo "📞 Étape 3 : Appel de la fonction avec la question..."
echo "Question : Comment est modélisé l'impact carbone de l'électricité en France ?"
echo ""

curl -s --no-buffer \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Content-Type: application/json" \
  -X POST \
  http://localhost:54321/functions/v1/llamacloud-chat-proxy \
  -d '{
    "message": "Comment est modélisé l'\''impact carbone de l'\''électricité en France ?",
    "source_name": "base_carbone",
    "product_context": "Électricité France",
    "language": "fr"
  }' > /tmp/response.txt 2>&1

echo ""
echo ""
echo "✅ Appel terminé"
echo ""

# Étape 5 : Afficher les logs
echo "📋 LOGS DE LA FONCTION :"
echo "========================"
cat /tmp/edge-function-logs.txt
echo ""
echo "========================"
echo ""

# Étape 6 : Stopper la fonction
echo "🛑 Arrêt de la fonction..."
kill $FUNCTION_PID 2>/dev/null
echo "✅ Fonction arrêtée"
echo ""

echo "🎉 Test terminé !"
echo ""
echo "📁 Les logs complets sont dans : /tmp/edge-function-logs.txt"
echo "📁 La réponse est dans : /tmp/response.txt"

