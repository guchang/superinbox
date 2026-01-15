#!/bin/bash

API_KEY="dev-key-change-this-in-production"
BASE_URL="http://localhost:3000/v1"

echo "=== Testing SuperInbox API ==="
echo ""

# Test 1: Create todo item
echo "1. Create todo item"
curl -s -X POST "$BASE_URL/inbox" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content":"明天下午3点和张三开会讨论项目进度","type":"text","source":"test"}' | jq '.'
echo ""

# Test 2: Create expense item
echo "2. Create expense item"
curl -s -X POST "$BASE_URL/inbox" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content":"买咖啡花了25元","type":"text","source":"test"}' | jq '.'
echo ""

# Test 3: Create idea item
echo "3. Create idea item"
curl -s -X POST "$BASE_URL/inbox" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content":"突然想到可以做一个自动整理邮件的工具","type":"text","source":"test"}' | jq '.'
echo ""

echo "=== Tests completed ==="
