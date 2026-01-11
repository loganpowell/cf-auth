# Durable Objects

Per-tenant state management and real-time synchronization using Cloudflare Durable Objects.

## Overview

Durable Objects provide single-threaded, globally distributed compute primitives with strong consistency guarantees. Each tenant gets dedicated DO instances for state management and WebSocket coordination.

## Architecture

```
┌─────────────────┐
│  Client (User)  │
└────────┬────────┘
         │ WebSocket
┌────────▼────────┐
│  TenantState DO │  Per-tenant connection hub
│  - Broadcast    │  - Mutation sync across clients
│  - Rate limit   │  - Activity tracking
│  - State cache  │  - KV persistence
└────────┬────────┘
         │
┌────────▼────────┐
│ GraphStateCSV   │  Per-tenant authorization graph
│  - CSV load R2  │  - Edge validation (O(1))
│  - Edge lookup  │  - Schema versioning
│  - Proof verify │  - Reload triggers
└─────────────────┘
```

## Classes

### TenantState

**Purpose**: Manage real-time connections and broadcast mutations to all active clients for a tenant.

**Lifecycle**:

- Created on first request for a tenant
- Hibernates after 5 minutes of inactivity
- Persists state to KV (`MUTATION_LOG`) on shutdown
- Loads from KV on cold start

**HTTP API**:

- `GET /state` - Get current tenant state (mutations, connections)
- `POST /mutation` - Apply mutation and broadcast to clients
- `POST /reset` - Clear tenant state

**WebSocket**:

- Real-time connection for mutation broadcasts
- Message types: `ping`, `pong`, `mutation`, `error`
- Auto-cleanup on disconnect

**Key Features**:

- WebSocket connection pool (Set<WebSocket>)
- Mutation logging to KV (30-day retention)
- Activity tracking (last_activity timestamp)
- Automatic state persistence

### GraphStateCSV

**Purpose**: Per-tenant authorization graph state loaded from CSV files in R2.

**Lifecycle**:

- Lazy initialization (loads CSV on first request)
- In-memory edge map (Map<edgeId, Edge>)
- Version tracking (timestamp-based)
- Reload trigger on schema updates

**HTTP API**:

- `POST /validate` - Validate edge proof chain for authorization
- `POST /reload` - Reload CSV files from R2
- `GET /state` - Get graph metadata (edge count, version, connections)

**WebSocket**:

- Subscribe to graph reload events
- Receive schema version updates
- Client-side cache invalidation

**CSV Schema**:
CSV files in R2 (`TENANT_DATA` bucket):

```
{tenantId}/member_of.csv
{tenantId}/inherits_from.csv
{tenantId}/user_permissions.csv
{tenantId}/group_permissions.csv
```

Each CSV has columns:

- `id` - Edge ID (UUID)
- `source` - Source node ID
- `target` - Target node ID
- `type` - Edge type (member_of, inherits_from, etc.)
- `permission` - Optional permission label (read, write, admin)
- `revoked_at` - Timestamp of revocation (null = active)

**Validation Algorithm**:

```typescript
// Edge proof: [edge1, edge2, edge3]
// Valid if:
//   1. All edges exist and not revoked
//   2. Chain connected: edge[i].target === edge[i+1].source
//   3. Endpoints match: edge[0].source === userId, edge[n].target === resourceId

validateChain([edge1, edge2, edge3], userId, resourceId)
  → { valid: true } or { valid: false, reason: "..." }
```

## Configuration

### wrangler.toml

```toml
[[durable_objects.bindings]]
name = "TENANT_STATE"
class_name = "TenantState"
script_name = "cf-auth"

[[durable_objects.bindings]]
name = "GRAPH_STATE_CSV"
class_name = "GraphStateCSV"
script_name = "cf-auth"

[[migrations]]
tag = "v1"
new_classes = ["TenantState", "GraphStateCSV"]
```

### Environment Bindings

```typescript
export interface Env {
  MUTATION_LOG: KVNamespace; // DO state persistence
  TENANT_DATA: R2Bucket; // CSV files per tenant
  TENANT_STATE: DurableObjectNamespace;
  GRAPH_STATE_CSV: DurableObjectNamespace;
}
```

## Usage

### Get Durable Object Instance

```typescript
// Get TenantState for a tenant
const tenantId = "tenant_123";
const doId = env.TENANT_STATE.idFromName(tenantId);
const stub = env.TENANT_STATE.get(doId);

// Make request to DO
const response = await stub.fetch("https://do/state");
const state = await response.json();
```

### Validate Authorization

```typescript
// Get GraphStateCSV for a tenant
const doId = env.GRAPH_STATE_CSV.idFromName(tenantId);
const stub = env.GRAPH_STATE_CSV.get(doId);

// Validate edge proof
const response = await stub.fetch("https://do/validate", {
  method: "POST",
  body: JSON.stringify({
    edgeIds: ["edge_123", "edge_456"],
    userId: "user_alice",
    resourceId: "resource_project_x",
  }),
});

const { valid, reason } = await response.json();
// → { valid: true } or { valid: false, reason: "Edge revoked: edge_123" }
```

### WebSocket Connection

```typescript
// Connect to TenantState
const doId = env.TENANT_STATE.idFromName(tenantId);
const stub = env.TENANT_STATE.get(doId);

const ws = new WebSocket("wss://do");
const response = await stub.fetch("https://do", {
  headers: { Upgrade: "websocket" },
});

ws.addEventListener("message", (event) => {
  const { type, mutation } = JSON.parse(event.data);
  if (type === "mutation") {
    console.log("Mutation broadcasted:", mutation);
  }
});
```

## Testing

### Local Development

Durable Objects work in local development with `wrangler dev`:

```bash
npm run dev
# Durable Objects available at http://localhost:8787
```

### Test DO Lifecycle

```bash
# Get TenantState
curl http://localhost:8787/tenant-state/tenant_123

# Apply mutation
curl -X POST http://localhost:8787/tenant-state/tenant_123/mutation \
  -H "Content-Type: application/json" \
  -d '{"type": "add_user", "userId": "user_alice"}'

# Validate edge proof
curl -X POST http://localhost:8787/graph-state/tenant_123/validate \
  -H "Content-Type: application/json" \
  -d '{"edgeIds": ["e1", "e2"], "userId": "alice", "resourceId": "project_x"}'
```

## Deployment

1. **Pulumi Infrastructure**: Provision KV, R2, D1

   ```bash
   cd infrastructure && pulumi up
   ```

2. **Sync Resource IDs**: Update wrangler.toml with production IDs

   ```bash
   ./infrastructure/update-wrangler.sh
   ```

3. **Deploy Worker**: Deploy with DO classes

   ```bash
   wrangler deploy
   ```

4. **Initialize CSV Files**: Upload initial CSV files to R2

   ```bash
   wrangler r2 object put tenant-data/tenant_123/member_of.csv \
     --file ./data/member_of.csv
   ```

5. **Test Production**: Verify DO instances created
   ```bash
   curl https://auth-service.workers.dev/tenant-state/tenant_123
   ```

## Best Practices

1. **Namespace Isolation**: Use `idFromName(tenantId)` to ensure per-tenant isolation
2. **Lazy Loading**: GraphStateCSV loads CSV files on first request (not constructor)
3. **State Persistence**: TenantState persists to KV every 5 minutes + on shutdown
4. **Error Handling**: All HTTP endpoints return structured JSON errors
5. **WebSocket Cleanup**: Connections auto-removed from set on disconnect
6. **CSV Validation**: Skip invalid rows, log warnings, continue processing
7. **Version Tracking**: Use timestamps for CSV version (reload detection)

## Monitoring

Key metrics to track:

- DO invocation count (per tenant)
- WebSocket connection count (active clients)
- CSV reload frequency (schema changes)
- Edge validation latency (authorization checks)
- State persistence errors (KV writes)

## Related Documentation

- [Multi-tenant Architecture](../../docs/multi-tenant-migration/MULTI_TENANT_ARCHITECTURE.md)
- [Admin Dashboard API](../routes/admin/README.md)
- [Cloudflare Durable Objects Docs](https://developers.cloudflare.com/durable-objects/)
- [R2 Storage](https://developers.cloudflare.com/r2/)
