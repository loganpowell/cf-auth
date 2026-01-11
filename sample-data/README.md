# Sample Authorization CSV Data for Testing

This directory contains sample CSV files for testing the GraphStateCSV Durable Object
and CSV-based authorization system.

## CSV Format

The CSV files define authorization relationships in the format:

```
subject_type,subject_id,relation,object_type,object_id
```

## Files

### graph-tenant_000.csv

Authorization graph for the main test tenant (tenant_000).

### graph-acme-corp.csv

Authorization graph for a sample enterprise tenant (acme-corp).

## Edge Chain Examples

The CSV data demonstrates these authorization patterns:

1. **Direct Ownership**
   - user:alice → owns → document:doc1
2. **Group Membership**

   - user:alice → member_of → group:engineering
   - group:engineering → can_view → document:doc2

3. **Hierarchical Organizations**

   - user:bob → works_at → org:acme
   - org:acme → owns → project:project-x
   - project:project-x → contains → document:doc3

4. **Transitive Relations**
   - user:alice → manages → user:charlie
   - user:charlie → owns → document:doc4
   - Query: Does alice have access to doc4 through management?

## Upload to R2

Once R2 is enabled, upload CSV files:

```bash
# Upload tenant_000 graph
wrangler r2 object put tenant-data-dev/tenants/tenant_000/graph.csv --file=sample-data/graph-tenant_000.csv

# Upload acme-corp graph
wrangler r2 object put tenant-data-dev/tenants/acme-corp/graph.csv --file=sample-data/graph-acme-corp.csv
```

## Testing

After upload, test the GraphStateCSV Durable Object:

```bash
# Load the graph
curl -X POST "https://auth-service.logan-607.workers.dev/do/graph-state/tenant_000/reload" \
  -H "Authorization: Bearer $ADMIN_API_KEY"

# Validate edge chains
curl -X POST "https://auth-service.logan-607.workers.dev/do/graph-state/tenant_000/validate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{
    "subject": "user:alice",
    "relation": "can_view",
    "object": "document:doc2"
  }'
```
