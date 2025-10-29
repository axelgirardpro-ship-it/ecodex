#!/bin/bash

# Script pour tester la fonction Edge en local
# La fonction doit être lancée avec : supabase functions serve llamacloud-chat-proxy

echo "🧪 Test de la fonction Edge llamacloud-chat-proxy en local"
echo ""
echo "📝 Question : Comment est modélisé l'impact carbone de l'électricité en France ?"
echo ""

# Récupérer le token d'authentification Supabase
# Note: En local avec --no-verify-jwt, on peut passer n'importe quel token
# Mais pour être réaliste, on utilise un token de test

curl -i --no-buffer \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Content-Type: application/json" \
  -X POST \
  http://localhost:54321/functions/v1/llamacloud-chat-proxy \
  -d '{
    "message": "Comment est modélisé l'\''impact carbone de l'\''électricité en France ?",
    "source_name": "base_carbone",
    "product_context": "Électricité France",
    "language": "fr"
  }'

echo ""
echo ""
echo "✅ Test terminé"

