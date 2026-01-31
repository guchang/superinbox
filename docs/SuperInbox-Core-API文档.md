# SuperInbox Core API Documentation

> **Version:** 0.1.0
> **Base URL:** `http://localhost:3000/v1`
> **Content-Type:** `application/json`

---

## Table of Contents

- [Authentication](#authentication)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Inbox API](#inbox-api)
- [Intelligence API](#intelligence-api)
- [Routing API](#routing-api)
- [Auth API](#auth-api)
- [Settings API](#settings-api)

---

## Authentication

All API endpoints require authentication using an API Key.

### Authorization Header

```
Authorization: Bearer sinbox_your_api_key_here
```

### Example

```bash
curl -X GET http://localhost:3000/v1/inbox \
  -H "Authorization: Bearer sinbox_your_api_key_here"
```

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

---

## Error Handling

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 400 | BAD_REQUEST | Invalid request parameters |
| 401 | UNAUTHORIZED | Missing or invalid API key |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource conflict |
| 422 | VALIDATION_ERROR | Request validation failed |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |

---

## Inbox API

### Create Item

Create a new item in the inbox.

**Endpoint:** `POST /v1/inbox`

**Request Body:**

```json
{
  "content": "Buy milk tomorrow at 9am",
  "source": "api",
  "contentType": "text"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "originalContent": "Buy milk tomorrow at 9am",
    "contentType": "text",
    "source": "api",
    "userId": "default-user",
    "intent": "todo",
    "entities": {
      "action": "buy",
      "item": "milk",
      "time": "tomorrow at 9am"
    },
    "summary": "Todo to buy milk",
    "suggestedTitle": "Buy milk",
    "status": "pending",
    "distributedTargets": [],
    "distributionResults": [],
    "createdAt": "2026-01-17T12:00:00.000Z",
    "updatedAt": "2026-01-17T12:00:00.000Z"
  }
}
```

---

### Batch Create Items

Create multiple items at once.

**Endpoint:** `POST /v1/inbox/batch`

**Request Body:**

```json
{
  "items": [
    {
      "content": "First item",
      "source": "api",
      "contentType": "text"
    },
    {
      "content": "Second item",
      "source": "api",
      "contentType": "text"
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "created": 2,
    "failed": 0,
    "items": [
      {
        "id": "...",
        "originalContent": "First item",
        "status": "pending"
      },
      {
        "id": "...",
        "originalContent": "Second item",
        "status": "pending"
      }
    ]
  }
}
```

---

### Search Items

Search items with filters.

**Endpoint:** `GET /v1/inbox/search`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | No | Search query string |
| `intent` | string | No | Filter by intent type |
| `status` | string | No | Filter by status |
| `limit` | number | No | Max results (default: 50) |
| `offset` | number | No | Pagination offset |

**Example:**

```bash
curl -X GET "http://localhost:3000/v1/inbox/search?q=milk&intent=todo&limit=10"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "...",
        "originalContent": "Buy milk",
        "intent": "todo",
        "status": "pending"
      }
    ],
    "total": 1,
    "limit": 10,
    "offset": 0
  }
}
```

---

### Get All Items

Get all items with optional filtering.

**Endpoint:** `GET /v1/inbox`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status |
| `intent` | string | No | Filter by intent |
| `limit` | number | No | Max results |
| `since` | string | No | ISO date string (only items updated since) |

**Example:**

```bash
curl -X GET "http://localhost:3000/v1/inbox?status=pending&limit=20"
```

**Response:**

```json
{
  "total": 42,
  "page": 1,
  "limit": 20,
  "entries": [
    {
      "id": "...",
      "content": "Buy milk",
      "category": "todo",
      "status": "pending",
      "createdAt": "2026-01-17T12:00:00.000Z"
    }
  ]
}
```

---

### Get Item by ID

Get a single item by ID.

**Endpoint:** `GET /v1/inbox/:id`

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "content": "Buy milk",
  "parsed": {
    "category": "todo",
    "confidence": 1,
    "entities": {}
  },
  "createdAt": "2026-01-17T12:00:00.000Z",
  "updatedAt": "2026-01-17T12:05:00.000Z"
}
```

---

### Update Item

Update an existing item.

**Endpoint:** `PUT /v1/inbox/:id`

**Request Body:**

```json
{
  "status": "completed"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "completed",
    "updatedAt": "2026-01-17T12:05:00.000Z"
  }
}
```

---

### Delete Item

Delete an item by ID.

**Endpoint:** `DELETE /v1/inbox/:id`

**Response:**

```json
{
  "success": true,
  "message": "Item deleted"
}
```

---

## Intelligence API

### Get AI Parse Result

Get the AI-parsed result for an item.

**Endpoint:** `GET /v1/intelligence/parse/:id`

**Response:**

```json
{
  "success": true,
  "data": {
    "itemId": "550e8400-e29b-41d4-a716-446655440000",
    "intent": "todo",
    "entities": {
      "action": "buy",
      "item": "milk",
      "time": "tomorrow at 9am",
      "location": "supermarket"
    },
    "summary": "Todo to buy milk at the supermarket tomorrow at 9am",
    "suggestedTitle": "Buy milk",
    "confidence": 0.95,
    "parsedAt": "2026-01-17T12:01:00.000Z"
  }
}
```

---

### Correct Parse Result

Manually correct the AI parse result.

**Endpoint:** `PATCH /v1/intelligence/parse/:id`

**Request Body:**

```json
{
  "intent": "schedule",
  "entities": {
    "title": "Buy milk",
    "datetime": "2026-01-18T09:00:00.000Z"
  },
  "summary": "Buy milk at the supermarket"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "itemId": "...",
    "intent": "schedule",
    "entities": {...},
    "summary": "Buy milk at the supermarket",
    "correctedAt": "2026-01-17T12:10:00.000Z"
  }
}
```

---

### Get Prompt Templates

Get all AI prompt templates.

**Endpoint:** `GET /v1/intelligence/prompts`

**Response:**

```json
{
  "success": true,
  "data": {
    "prompts": [
      {
        "id": "default-intent-classifier",
        "type": "intent",
        "template": "Analyze the following text...",
        "version": "1.0"
      }
    ]
  }
}
```

---

## Routing API

### Get All Routing Rules

Get all routing rules.

**Endpoint:** `GET /v1/routing/rules`

**Response:**

```json
{
  "success": true,
  "data": {
    "rules": [
      {
        "id": "rule-1",
        "name": "Todo to Notion",
        "enabled": true,
        "conditions": {
          "intent": ["todo", "schedule"]
        },
        "actions": [
          {
            "type": "notion",
            "config": {
              "databaseId": "abc123"
            }
          }
        }
      }
    ]
  }
}
```

---

### Create Routing Rule

Create a new routing rule.

**Endpoint:** `POST /v1/routing/rules`

**Request Body:**

```json
{
  "name": "Expenses to Webhook",
  "enabled": true,
  "conditions": {
    "intent": ["expense"]
  },
  "actions": [
    {
      "type": "webhook",
      "config": {
        "url": "https://example.com/webhook"
      }
    }
  ]
}
```

---

### Update Routing Rule

Update an existing routing rule.

**Endpoint:** `PUT /v1/routing/rules/:id`

---

### Delete Routing Rule

Delete a routing rule.

**Endpoint:** `DELETE /v1/routing/rules/:id`

---

### Dispatch Item

Manually trigger routing for an item.

**Endpoint:** `POST /v1/routing/dispatch/:id`

**Response:**

```json
{
  "success": true,
  "data": {
    "itemId": "...",
    "dispatched": true,
    "results": [
      {
        "target": "notion",
        "success": true,
        "targetId": "notion-page-123"
      }
    ]
  }
}
```

---

## Auth API

### List API Keys

Get all API keys for current user.

**Endpoint:** `GET /v1/auth/api-keys`

**Response:**

```json
{
  "success": true,
  "data": {
    "keys": [
      {
        "id": "key-1",
        "name": "Development Key",
        "keyValue": "sinbox_abc123...",
        "scopes": ["full"],
        "isActive": true,
        "lastUsed": "2026-01-17T12:00:00.000Z",
        "createdAt": "2026-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

### Create API Key

Create a new API key.

**Endpoint:** `POST /v1/auth/api-keys`

**Request Body:**

```json
{
  "name": "My New Key",
  "scopes": ["read", "write"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "key-2",
    "name": "My New Key",
    "keyValue": "sinbox_xyz789...",
    "scopes": ["read", "write"],
    "isActive": true,
    "createdAt": "2026-01-17T12:15:00.000Z"
  }
}
```

---

### Delete API Key

Delete an API key.

**Endpoint:** `DELETE /v1/auth/api-keys/:id`

---

### Disable API Key

Disable an API key without deleting it.

**Endpoint:** `POST /v1/auth/api-keys/:id/disable`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "key-1",
    "isActive": false,
    "disabledAt": "2026-01-17T12:20:00.000Z"
  }
}
```

---

### Enable API Key

Re-enable a disabled API key.

**Endpoint:** `POST /v1/auth/api-keys/:id/enable`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "key-1",
    "isActive": true,
    "enabledAt": "2026-01-17T12:25:00.000Z"
  }
}
```

---

## Settings API

> **Note:** Settings endpoints are now deprecated. Use specialized APIs instead:
> - API Keys → `/v1/auth/api-keys`
> - Statistics → Will be moved to `/v1/statistics` in future versions

### Get Statistics

Get system usage statistics.

**Endpoint:** `GET /v1/settings/statistics`

**Response:**

```json
{
  "success": true,
  "data": {
    "totalItems": 150,
    "itemsByIntent": {
      "todo": 50,
      "note": 30,
      "idea": 20
    },
    "itemsByStatus": {
      "pending": 80,
      "completed": 60,
      "failed": 10
    },
    "avgProcessingTime": 1.2,
    "todayItems": 15,
    "weekItems": 75,
    "monthItems": 150
  }
}
```

---

### Get Logs (Deprecated)

Get system logs.

**Endpoint:** `GET /v1/settings/logs`

> **Deprecated:** This endpoint will be removed in v0.2.0. Use proper logging infrastructure instead.

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default Limit:** 100 requests per 15 minutes per API key
- **Headers:**
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## Versioning

API version is specified in the URL path: `/v1/`

Major versions may introduce breaking changes. Minor versions are backward compatible.

---

## Changelog

### Version 0.1.0 (2026-01-17)

**New Endpoints:**
- POST `/v1/inbox/batch` - Batch create items
- GET `/v1/inbox/search` - Search items with filters
- GET `/v1/intelligence/parse/:id` - Get AI parse result
- PATCH `/v1/intelligence/parse/:id` - Correct AI parse result
- POST `/v1/routing/dispatch/:id` - Manual dispatch
- POST `/v1/auth/api-keys/:id/disable` - Disable API key
- POST `/v1/auth/api-keys/:id/enable` - Enable API key

**Deprecated:**
- `/v1/settings/logs` - Will be removed in v0.2.0

---

## Support

For issues or questions:
- GitHub: https://github.com/your-org/superinbox
- Documentation: https://docs.superinbox.com
- Email: support@superinbox.com
