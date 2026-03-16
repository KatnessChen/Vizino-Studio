#!/bin/bash
# Test script to verify Firebase Storage upload in the Cloud Function
# This sends a tiny 1x1 PNG image to test the storage upload path

# Minimal 1x1 red PNG in base64 (67 bytes)
TINY_PNG="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

ENDPOINT="${1:-http://localhost:8080}"
SCALE="${2:-4}"  # Use scale=4 to trigger Storage upload path

echo "=== Testing Cloud Function Storage Upload ==="
echo "Endpoint: $ENDPOINT"
echo "Scale: $SCALE (scale=4 triggers Firebase Storage upload)"
echo ""

curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"imageBase64\": \"$TINY_PNG\",
    \"imageMimeType\": \"image/png\",
    \"scale\": $SCALE,
    \"userId\": \"test-user-123\",
    \"spaceId\": \"test-space-456\"
  }" | python3 -m json.tool 2>/dev/null || echo "(raw output above)"

echo ""
echo "=== Done ==="
