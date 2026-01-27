#!/bin/bash

# Test script for batch redistribute API

API_KEY="${API_KEY:-dev-key-change-this-in-production}"
API_URL="${API_URL:-http://localhost:3000}"

echo "=== Testing Batch Redistribute API ==="
echo "API URL: $API_URL"
echo ""

# Test 1: Start batch redistribution
echo "Test 1: POST /v1/inbox/batch-redistribute"
echo "Request body: {\"filter\":{\"status\":\"completed\"},\"batchSize\":5,\"delayBetweenBatches\":3000}"
echo ""

curl -X POST "$API_URL/v1/inbox/batch-redistribute" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "status": "completed"
    },
    "batchSize": 5,
    "delayBetweenBatches": 3000
  }' | jq '.'

echo ""
echo ""

# Test 2: Get batch status
echo "Test 2: GET /v1/inbox/batch-redistribute/status"
echo ""

curl -X GET "$API_URL/v1/inbox/batch-redistribute/status" \
  -H "Authorization: Bearer $API_KEY" | jq '.'

echo ""
echo "=== Tests Complete ==="
