#!/bin/bash

# Test Edge Function consistency with auth
EDGE_URL="https://wrodvaatdujbpfpvrzge.supabase.co/functions/v1/algolia-search-proxy?origin=public"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyb2R2YWF0ZHVqYnBmcHZyemdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MzE3MzgsImV4cCI6MjA2OTMwNzczOH0.0ac4Hjbb09n7V8orvD16jtj0ZA6Qz8T0PBM3y33fQ0s"

echo "Testing Edge Function consistency (20 requests)..."
echo ""

CEDA_PRESENT=0
CEDA_ABSENT=0

for i in {1..20}; do
  echo -n "Request #$i... "
  
  RESPONSE=$(curl -s -X POST "$EDGE_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ANON_KEY" \
    -d '{
      "requests": [{
        "params": {
          "query": "",
          "facets": ["Source"],
          "maxValuesPerFacet": 1500,
          "hitsPerPage": 20,
          "page": 0
        }
      }]
    }')
  
  SOURCE_COUNT=$(echo "$RESPONSE" | jq -r '.results[0].facets.Source | length' 2>/dev/null)
  HAS_CEDA=$(echo "$RESPONSE" | jq -r '.results[0].facets.Source | has("CEDA by Watershed")' 2>/dev/null)
  
  if [ "$HAS_CEDA" == "true" ]; then
    echo "✓ CEDA PRESENT ($SOURCE_COUNT sources)"
    CEDA_PRESENT=$((CEDA_PRESENT + 1))
  elif [ "$HAS_CEDA" == "false" ]; then
    echo "✗ CEDA ABSENT ($SOURCE_COUNT sources)"
    CEDA_ABSENT=$((CEDA_ABSENT + 1))
  else
    echo "? Error: $RESPONSE" | head -c 100
    echo ""
  fi
  
  sleep 0.3
done

echo ""
echo "=== RESULTS ==="
echo "CEDA Present: $CEDA_PRESENT/20"
echo "CEDA Absent:  $CEDA_ABSENT/20"
echo ""

if [ $CEDA_PRESENT -gt 0 ] && [ $CEDA_ABSENT -gt 0 ]; then
  echo "❌ INCONSISTENCY CONFIRMED in Edge Function"
  echo ""
  echo "Possible causes:"
  echo "  1. Post-processing logic (postProcessResults) filters out CEDA inconsistently"
  echo "  2. assignedSources logic has race conditions"
  echo "  3. Multiple Edge Function instances with different states"
elif [ $CEDA_PRESENT -eq 20 ]; then
  echo "✅ CONSISTENT: CEDA always present via Edge Function"
elif [ $CEDA_ABSENT -eq 20 ]; then
  echo "⚠️  CONSISTENT but CEDA always absent"
  echo "    This suggests post-processing is consistently filtering it out"
else
  echo "⚠️  Unable to determine"
fi

