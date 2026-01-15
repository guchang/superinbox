#!/bin/bash

# SuperInbox Core - cURL Examples
# Make sure the server is running before executing these commands

API_KEY="dev-key-change-this-in-production"
BASE_URL="http://localhost:3000/v1"

echo "======================================"
echo "SuperInbox Core API - cURL Examples"
echo "======================================"

# 1. Health Check
echo -e "\n1. Health Check"
curl -s "$BASE_URL/../health" | jq '.'

# 2. Create Item (Send to inbox)
echo -e "\n2. Create Item - 待办事项"
ITEM_ID=$(curl -s -X POST "$BASE_URL/inbox" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "明天下午3点和张三开会讨论项目进度",
    "source": "telegram",
    "type": "text"
  }' | jq -r '.data.id')

echo "Created item ID: $ITEM_ID"

# 3. Wait for AI processing
echo -e "\n3. Waiting for AI processing..."
sleep 3

# 4. Get Item by ID
echo -e "\n4. Get Item by ID"
curl -s "$BASE_URL/items/$ITEM_ID" \
  -H "Authorization: Bearer $API_KEY" | jq '.'

# 5. List All Items
echo -e "\n5. List All Items"
curl -s "$BASE_URL/items?limit=5" \
  -H "Authorization: Bearer $API_KEY" | jq '.'

# 6. Create Expense Item
echo -e "\n6. Create Expense Item"
curl -s -X POST "$BASE_URL/inbox" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "星巴克咖啡 35元",
    "type": "text"
  }' | jq '.'

# 7. Create Idea Item
echo -e "\n7. Create Idea Item"
curl -s -X POST "$BASE_URL/inbox" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "突然想到可以做一个自动整理邮件的AI工具",
    "type": "text"
  }' | jq '.'

# 8. Create Bookmark Item
echo -e "\n8. Create Bookmark Item"
curl -s -X POST "$BASE_URL/inbox" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "https://github.com/SuperInbox/core",
    "type": "url"
  }' | jq '.'

# 9. Filter by Intent
echo -e "\n9. Filter Items by Intent (todo)"
curl -s "$BASE_URL/items?intent=todo&limit=3" \
  -H "Authorization: Bearer $API_KEY" | jq '.'

# 10. Filter by Status
echo -e "\n10. Filter Items by Status (completed)"
curl -s "$BASE_URL/items?status=completed&limit=3" \
  -H "Authorization: Bearer $API_KEY" | jq '.'

echo -e "\n======================================"
echo "Examples completed!"
echo "======================================"
