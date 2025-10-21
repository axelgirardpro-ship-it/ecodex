#!/bin/bash

# Test direct Algolia API for facet consistency
# This bypasses the Edge Function entirely

ALGOLIA_APP_ID="6SRUR7BWK6"
ALGOLIA_ADMIN_KEY="0db7b6a3d568a25885c0665d044c8803"
ALGOLIA_INDEX="ef_all"

echo "Testing direct Algolia API for facet consistency..."
echo "This will make 10 consecutive requests with empty query to check for CEDA by Watershed"
echo ""

CEDA_PRESENT=0
CEDA_ABSENT=0

for i in {1..10}; do
  echo "Request #$i..."
  
  # Make direct request to Algolia
  RESPONSE=$(curl -s -X POST \
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
  
  # Check if response contains facets
  SOURCE_COUNT=$(echo "$RESPONSE" | jq -r '.facets.Source | length' 2>/dev/null)
  HAS_CEDA=$(echo "$RESPONSE" | jq -r '.facets.Source | has("CEDA by Watershed")' 2>/dev/null)
  
  if [ "$HAS_CEDA" == "true" ]; then
    echo "  ✓ CEDA by Watershed PRESENT ($SOURCE_COUNT total sources)"
    CEDA_PRESENT=$((CEDA_PRESENT + 1))
  elif [ "$HAS_CEDA" == "false" ]; then
    echo "  ✗ CEDA by Watershed ABSENT ($SOURCE_COUNT total sources)"
    CEDA_ABSENT=$((CEDA_ABSENT + 1))
  else
    echo "  ? Error parsing response"
    echo "  Response: $RESPONSE"
  fi
  
  sleep 0.5
done

echo ""
echo "=== RESULTS ==="
echo "CEDA Present: $CEDA_PRESENT/10"
echo "CEDA Absent:  $CEDA_ABSENT/10"
echo ""

if [ $CEDA_PRESENT -gt 0 ] && [ $CEDA_ABSENT -gt 0 ]; then
  echo "❌ INCONSISTENCY CONFIRMED at Algolia API level"
  echo "The problem originates from Algolia, not from the Edge Function or frontend."
  echo ""
  echo "Possible causes:"
  echo "  1. Algolia CDN caching with different cache states"
  echo "  2. Algolia distributed replica inconsistency"
  echo "  3. Algolia query sampling/routing to different nodes"
elif [ $CEDA_PRESENT -eq 10 ]; then
  echo "✅ CONSISTENT: CEDA always present"
  echo "The inconsistency might be in the Edge Function or frontend."
elif [ $CEDA_ABSENT -eq 10 ]; then
  echo "✅ CONSISTENT: CEDA always absent"
  echo "This suggests a data or configuration issue, but no inconsistency."
else
  echo "⚠️  Unable to determine consistency"
fi

