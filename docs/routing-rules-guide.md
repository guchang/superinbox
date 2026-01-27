# Routing Rules User Guide

## Overview

Routing rules allow you to automatically route incoming items to multiple targets based on conditions. Rules are evaluated by priority (highest first) before distribution configs.

## How It Works

### Distribution Flow

```
1. Item received
   ↓
2. AI analyzes content (category, entities, summary)
   ↓
3. Routing Rules evaluated (highest priority first)
   ├─ Match? → Execute actions
   └─ No match? → Continue to next rule
   ↓
4. Distribution configs evaluated (fallback)
   └─ Match? → Distribute to MCP adapter
```

### Rule Actions

| Action | Description | Example |
|--------|-------------|---------|
| `distribute_mcp` | Send to MCP adapter | Add todo to Notion database |
| `distribute_adapter` | Send to traditional adapter | Send to webhook |
| `update_item` | Modify item properties | Change priority to high |
| `skip_distribution` | Halt further distribution | Stop processing |

### Condition Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | category equals "todo" |
| `not_equals` | Not equal | category not equals "note" |
| `contains` | Contains substring | content contains "urgent" |
| `not_contains` | Does not contain | content not contains "test" |
| `starts_with` | Starts with | content starts with "TODO:" |
| `ends_with` | Ends with | content ends with "!" |
| `regex` | Regex match | content matches "/^@reminder/" |
| `in` | In array | category in ["todo", "schedule"] |
| `not_in` | Not in array | category not in ["note", "bookmark"] |

## Creating Rules

### Example 1: Route todos to Notion

```json
{
  "name": "Todos to Notion",
  "description": "Send all todo items to Notion Tasks database",
  "priority": 100,
  "conditions": [
    {
      "field": "category",
      "operator": "equals",
      "value": "todo"
    }
  ],
  "actions": [
    {
      "type": "distribute_mcp",
      "mcp_adapter_id": "notion-adapter-id",
      "processing_instructions": "Create a task in the Tasks database"
    }
  ],
  "isActive": true
}
```

### Example 2: High priority items

```json
{
  "name": "Urgent items high priority",
  "description": "Mark urgent items as high priority",
  "priority": 90,
  "conditions": [
    {
      "field": "originalContent",
      "operator": "contains",
      "value": "urgent"
    }
  ],
  "actions": [
    {
      "type": "update_item",
      "updates": {
        "priority": "high"
      }
    }
  ],
  "isActive": true
}
```

### Example 3: Skip test items

```json
{
  "name": "Skip test items",
  "description": "Don't distribute items containing 'test'",
  "priority": 50,
  "conditions": [
    {
      "field": "originalContent",
      "operator": "contains",
      "value": "test"
    }
  ],
  "actions": [
    {
      "type": "skip_distribution"
    }
  ],
  "isActive": true
}
```

### Example 4: Multi-condition rule

```json
{
  "name": "Work expenses to Finance",
  "description": "Route work-related expenses to Finance team",
  "priority": 80,
  "conditions": [
    {
      "field": "category",
      "operator": "equals",
      "value": "expense"
    },
    {
      "field": "originalContent",
      "operator": "contains",
      "value": "work"
    }
  ],
  "actions": [
    {
      "type": "distribute_mcp",
      "mcp_adapter_id": "notion-finance-db",
      "processing_instructions": "Create expense record with work tag"
    },
    {
      "type": "update_item",
      "updates": {
        "priority": "medium",
        "tags": ["work", "expense", "finance"]
      }
    }
  ],
  "isActive": true,
  "logicalOperator": "AND"
}
```

## API Reference

### Create Rule

```http
POST /v1/routing/rules
Content-Type: application/json
Authorization: Bearer your-api-key

{
  "name": "Rule name",
  "description": "Optional description",
  "priority": 100,
  "conditions": [
    {
      "field": "category",
      "operator": "equals",
      "value": "todo"
    }
  ],
  "actions": [
    {
      "type": "distribute_mcp",
      "mcp_adapter_id": "adapter-id",
      "processing_instructions": "Optional instructions"
    }
  ],
  "isActive": true
}
```

### Update Rule

```http
PUT /v1/routing/rules/:id
Content-Type: application/json
Authorization: Bearer your-api-key

{
  "name": "Updated name",
  "priority": 150,
  "isActive": false
}
```

### Delete Rule

```http
DELETE /v1/routing/rules/:id
Authorization: Bearer your-api-key
```

### List Rules

```http
GET /v1/routing/rules
Authorization: Bearer your-api-key

# Response
{
  "rules": [
    {
      "id": "rule-id",
      "name": "Rule name",
      "priority": 100,
      "isActive": true,
      "conditions": [...],
      "actions": [...],
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Best Practices

1. **Priority**: Use higher priority (100+) for specific rules, lower (10-50) for general rules
2. **Testing**: Use test items to verify rules before enabling
3. **Skip**: Use `skip_distribution` to prevent unwanted distributions
4. **Combine**: Chain multiple actions in a single rule for complex workflows
5. **Fallback**: Keep distribution configs as fallback for unmatched items
6. **Performance**: Index high-volume conditions (category, status) for faster evaluation
7. **Monitoring**: Check distribution results to ensure rules work as expected

## Troubleshooting

### Rule not executing?

**Checklist:**
- [ ] `isActive` is set to `true`
- [ ] Conditions match your item (check field names and values)
- [ ] Priority is high enough (higher priority rules execute first)
- [ ] Action configuration is valid (adapter IDs, field names)
- [ ] Logical operator (AND/OR) matches your intent

**Debug steps:**
```bash
# Check rule evaluation logs
tail -f backend.log | grep "Routing rule"

# Test with a specific item
curl -X POST http://localhost:3000/v1/inbox/test-rule \
  -H "Content-Type: application/json" \
  -d '{"ruleId": "your-rule-id", "testItem": {...}}'
```

### Batch redistribution?

Use the batch API with safe defaults:
```json
POST /v1/inbox/batch-redistribute
Content-Type: application/json

{
  "filter": {
    "status": "completed"
  },
  "batchSize": 10,
  "delayBetweenBatches": 5000,
  "dryRun": false
}
```

**Parameters:**
- `filter`: Item filter criteria
- `batchSize`: Items per batch (default: 10, max: 50)
- `delayBetweenBatches`: Delay in ms (default: 5000)
- `dryRun`: Test without actually distributing (default: false)

**Track progress:**
```http
GET /v1/inbox/batch-redistribute/status
```

### Rate limiting?

The system includes a global rate limiter:
- **60 RPM** (requests per minute)
- **Burst capacity**: 10 tokens
- Applied automatically during distribution
- Prevents 429 rate limit errors

**If you hit rate limits:**
1. Increase `delayBetweenBatches` in batch operations
2. Reduce `batchSize` for slower throughput
3. Check LLM provider quota limits

### Common errors

**"No matching adapter found"**
- Verify `mcp_adapter_id` exists in MCP adapters table
- Check adapter is properly configured

**"Invalid field in condition"**
- Valid fields: `id`, `originalContent`, `contentType`, `source`, `category`, `summary`, `status`, `priority`, `createdAt`, `updatedAt`
- Use exact field names (case-sensitive)

**"Invalid action type"**
- Valid actions: `distribute_mcp`, `distribute_adapter`, `update_item`, `skip_distribution`
- Check action configuration matches type

## Advanced Patterns

### Pattern 1: Conditional Priority

Set priority based on content:
```json
{
  "name": "Mark urgent as high priority",
  "conditions": [
    {
      "field": "originalContent",
      "operator": "regex",
      "value": "^(urgent|critical|asap)"
    }
  ],
  "actions": [
    {
      "type": "update_item",
      "updates": {
        "priority": "high"
      }
    }
  ]
}
```

### Pattern 2: Multi-target Distribution

Send to multiple destinations:
```json
{
  "name": "Important items everywhere",
  "conditions": [
    {
      "field": "priority",
      "operator": "equals",
      "value": "high"
    }
  ],
  "actions": [
    {
      "type": "distribute_mcp",
      "mcp_adapter_id": "notion-tasks",
      "processing_instructions": "Create as high-priority task"
    },
    {
      "type": "distribute_adapter",
      "adapterType": "webhook",
      "adapterId": "slack-webhook",
      "config": {
        "channel": "#urgent"
      }
    }
  ]
}
```

### Pattern 3: Filter and Transform

Filter out noise and enrich items:
```json
{
  "name": "Enrich bookmarks",
  "conditions": [
    {
      "field": "category",
      "operator": "equals",
      "value": "bookmark"
    },
    {
      "field": "originalContent",
      "operator": "not_contains",
      "value": "spam"
    }
  ],
  "actions": [
    {
      "type": "update_item",
      "updates": {
        "tags": ["reading-list", "to-review"]
      }
    },
    {
      "type": "distribute_mcp",
      "mcp_adapter_id": "notion-reading-list"
    }
  ]
}
```

## Performance Considerations

### Database Indexing

Rules table has indexes on:
- `priority` (DESC) - For rule evaluation order
- `isActive` - For active rule filtering
- `category` - For category-based conditions

### Evaluation Complexity

- Each rule checks conditions against item fields
- N+1 queries prevented by batching
- Typical evaluation: < 50ms per item

### Optimization Tips

1. **Use specific conditions first**: Category filters are faster than content regex
2. **Order rules by specificity**: High-priority rules should match fewer items
3. **Use `skip_distribution` early**: Stop processing for filtered items
4. **Batch when redistributing**: Use batch API instead of individual calls

## Integration with Distribution Configs

Routing rules and distribution configs work together:

1. **Rules first**: All routing rules evaluated by priority
2. **Configs fallback**: If no rule matches, distribution configs evaluated
3. **Both can coexist**: Use rules for complex logic, configs for simple mapping

### When to use which?

| Use Case | Recommendation |
|----------|----------------|
| Simple category-to-adapter mapping | Distribution config |
| Multi-condition logic | Routing rule |
| Multiple actions per item | Routing rule |
| Priority-based routing | Routing rule |
| Content-based filtering | Routing rule |
| One-to-one mapping | Distribution config |

## Migration Guide

### From Distribution Configs to Routing Rules

If you're using distribution configs and want to migrate to routing rules:

**Old approach (Distribution Config):**
```json
{
  "name": "Todos to Notion",
  "matchCriteria": {
    "category": "todo"
  },
  "mcpAdapterId": "notion-tasks"
}
```

**New approach (Routing Rule):**
```json
{
  "name": "Todos to Notion",
  "priority": 100,
  "conditions": [
    {
      "field": "category",
      "operator": "equals",
      "value": "todo"
    }
  ],
  "actions": [
    {
      "type": "distribute_mcp",
      "mcp_adapter_id": "notion-tasks"
    }
  ],
  "isActive": true
}
```

**Benefits of migrating:**
- Multiple actions per rule
- Better priority control
- More condition operators
- Skip distribution capability
- Item updates before distribution

## See Also

- [API Documentation](./SuperInbox-Core-API文档.md) - Complete API reference
- [Architecture Documentation](../CLAUDE.md) - System architecture details
- [MCP Adapters Guide](./instructions/mcp-adapters.md) - MCP adapter configuration
