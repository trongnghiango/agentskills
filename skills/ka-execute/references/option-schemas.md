# Option Schemas

Each action's `options` JSON is validated at Step 4b **before** routing. Reject and re-prompt on any missing required field or wrong type — never forward a payload the target skill wasn't designed to receive.

```json
{
  "backend": {
    "required": ["feature", "details"],
    "properties": {
      "feature": { "type": "string", "description": "short slug, e.g. 'auth'" },
      "details": { "type": "string", "description": "what to implement, e.g. 'Add JWT login'" },
      "affected_modules": { "type": "array", "items": { "type": "string" }, "required": false }
    }
  },
  "frontend": {
    "required": ["page", "features"],
    "properties": {
      "page": { "type": "string", "description": "target page/route, e.g. 'dashboard'" },
      "features": { "type": "array", "items": { "type": "string" }, "description": "e.g. ['charts','filters']" }
    }
  },
  "schema": {
    "required": ["table", "change_type"],
    "properties": {
      "table": { "type": "string" },
      "change_type": { "type": "string", "enum": ["add_column", "add_table", "alter_column", "drop_column", "drop_table", "add_index"] },
      "details": { "type": "string", "required": false },
      "migration_reversible": { "type": "boolean", "description": "required for change_type in [drop_column, drop_table]" }
    }
  },
  "contract": {
    "required": ["feature", "endpoints"],
    "properties": {
      "feature": { "type": "string", "description": "feature slug, e.g. 'orders'" },
      "endpoints": { "type": "array", "items": { "type": "string" }, "description": "e.g. ['GET /api/v1/orders', 'POST /api/v1/orders']" },
      "generate_client": { "type": "boolean", "description": "run Orval client generation after spec update", "required": false }
    }
  },
  "test": {
    "required": ["target"],
    "properties": {
      "target": { "type": "string", "description": "module/feature under test, e.g. 'auth'" },
      "test_type": { "type": "string", "enum": ["unit", "integration", "e2e", "visual"], "required": false }
    }
  },
  "ops": {
    "required": ["env", "action"],
    "properties": {
      "env": { "type": "string", "enum": ["staging", "production"] },
      "action": { "type": "string", "enum": ["deploy", "rollback", "restart", "scale"] },
      "rollback_plan": { "type": "string", "description": "required if env == 'production'" }
    }
  }
}
```

If a `custom` action is added to the Routing Table in `SKILL.md`, add its schema here in the same shape before enabling it — an action without a schema entry must be rejected at Step 4b rather than passed through unchecked.
