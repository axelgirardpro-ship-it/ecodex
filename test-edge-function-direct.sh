#!/bin/bash

echo "🚀 Test direct de la Edge Function en production"
echo "==============================================="
echo ""

curl -v --no-buffer \
  -H "Authorization: Bearer test-dashboard-token" \
  -H "Content-Type: application/json" \
  -X POST \
  https://wrodvaatdujbpfpvrzge.supabase.co/functions/v1/llamacloud-chat-proxy \
  -d '{
    "message": "Comment est modélisé l'\''impact carbone de l'\''électricité en France ?",
    "source_name": "base_carbone",
    "product_context": "Électricité France",
    "language": "fr"
  }'

echo ""
echo ""
echo "✅ Test terminé"

