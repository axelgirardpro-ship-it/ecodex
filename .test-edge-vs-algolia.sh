#!/bin/bash

# Compare Edge Function vs Direct Algolia API

ALGOLIA_APP_ID="6SRUR7BWK6"
ALGOLIA_ADMIN_KEY="0db7b6a3d568a25885c0665d044c8803"
ALGOLIA_INDEX="ef_all"
EDGE_FUNCTION_URL="https://tzdfsauxbwqrfcehfyzt.supabase.co/functions/v1/algolia-search-proxy?origin=public"

echo "Comparing Edge Function vs Direct Algolia API..."
echo ""

EDGE_CEDA_PRESENT=0
EDGE_CEDA_ABSENT=0
ALGOLIA_CEDA_PRESENT=0
ALGOLIA_CEDA_ABSENT=0

for i in {1..10}; do
  echo "=== Request #$i ==="
  
  # Test Edge Function
  echo "Testing Edge Function..."
  EDGE_RESPONSE=$(curl -s -X POST \
    "$EDGE_FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -d '{
      "requests": [
        {
          "params": {
            "query": "",
            "facets": ["Source"],
            "maxValuesPerFacet": 1500,
            "hitsPerPage": 20,
            "page": 0
          }
        }
      ]
    }')
  
  EDGE_SOURCE_COUNT=$(echo "$EDGE_RESPONSE" | jq -r '.results[0].facets.Source | length' 2>/dev/null)
  EDGE_HAS_CEDA=$(echo "$EDGE_RESPONSE" | jq -r '.results[0].facets.Source | has("CEDA by Watershed")' 2>/dev/null)
  
  if [ "$EDGE_HAS_CEDA" == "true" ]; then
    echo "  Edge: ✓ CEDA PRESENT ($EDGE_SOURCE_COUNT sources)"
    EDGE_CEDA_PRESENT=$((EDGE_CEDA_PRESENT + 1))
  elif [ "$EDGE_HAS_CEDA" == "false" ]; then
    echo "  Edge: ✗ CEDA ABSENT ($EDGE_SOURCE_COUNT sources)"
    EDGE_CEDA_ABSENT=$((EDGE_CEDA_ABSENT + 1))
  else
    echo "  Edge: ? Error parsing response"
    echo "  Response snippet: $(echo "$EDGE_RESPONSE" | jq -r '.results[0].facets' 2>/dev/null | head -n 5)"
  fi
  
  # Test Direct Algolia
  echo "Testing Direct Algolia..."
  ALGOLIA_RESPONSE=$(curl -s -X POST \
    "https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query" \
    -H "X-Algolia-API-Key: ${ALGOLIA_ADMIN_KEY}" \
    -H "X-Algolia-Application-Id: ${ALGOLIA_APP_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "query": "",
      "facets": ["Source"],
      "maxValuesPerFacet": 1500,
      "hitsPerPage": 20,
      "page": 0
    }')
  
  ALGOLIA_SOURCE_COUNT=$(echo "$ALGOLIA_RESPONSE" | jq -r '.facets.Source | length' 2>/dev/null)
  ALGOLIA_HAS_CEDA=$(echo "$ALGOLIA_RESPONSE" | jq -r '.facets.Source | has("CEDA by Watershed")' 2>/dev/null)
  
  if [ "$ALGOLIA_HAS_CEDA" == "true" ]; then
    echo "  Algolia: ✓ CEDA PRESENT ($ALGOLIA_SOURCE_COUNT sources)"
    ALGOLIA_CEDA_PRESENT=$((ALGOLIA_CEDA_PRESENT + 1))
  elif [ "$ALGOLIA_HAS_CEDA" == "false" ]; then
    echo "  Algolia: ✗ CEDA ABSENT ($ALGOLIA_SOURCE_COUNT sources)"
    ALGOLIA_CEDA_ABSENT=$((ALGOLIA_CEDA_ABSENT + 1))
  else
    echo "  Algolia: ? Error parsing response"
  fi
  
  echo ""
  sleep 0.5
done

echo ""
echo "=== FINAL RESULTS ==="
echo ""
echo "Edge Function:"
echo "  CEDA Present: $EDGE_CEDA_PRESENT/10"
echo "  CEDA Absent:  $EDGE_CEDA_ABSENT/10"
echo ""
echo "Direct Algolia:"
echo "  CEDA Present: $ALGOLIA_CEDA_PRESENT/10"
echo "  CEDA Absent:  $ALGOLIA_CEDA_ABSENT/10"
echo ""

if [ $EDGE_CEDA_PRESENT -gt 0 ] && [ $EDGE_CEDA_ABSENT -gt 0 ]; then
  echo "❌ EDGE FUNCTION INCONSISTENCY CONFIRMED"
  if [ $ALGOLIA_CEDA_PRESENT -eq 10 ]; then
    echo "   Algolia is consistent, but Edge Function is not!"
    echo "   Problem is in the Edge Function filtering/processing logic."
  fi
elif [ $EDGE_CEDA_PRESENT -eq 10 ] && [ $ALGOLIA_CEDA_PRESENT -eq 10 ]; then
  echo "✅ Both Edge Function and Algolia are CONSISTENT"
  echo "   The inconsistency you're seeing might be:"
  echo "   - Frontend caching/state management"
  echo "   - Browser caching"
  echo "   - React InstantSearch state"
else
  echo "⚠️  Mixed results - further investigation needed"
fi

