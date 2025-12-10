# Permission Superset Model

## Overview

This authentication service uses a **flexible permission superset model** where permissions flow hierarchically from organization owners (the "masters of keys") down through delegated users. The key principle is: **you can only grant permissions you yourself possess**.

## Core Concepts

### 1. Permission Superset

The **superset** is the complete set of all possible permissions in the system. Organization owners automatically receive this full superset when they create an organization.

```
FULL SUPERSET = {
  org.read, org.write, org.delete, org.transfer,
  org.members.*, org.billing.*, org.settings.*,
  resource.*.create, resource.*.read, resource.*.update, resource.*.delete,
  resource.*.permissions.*, data.*, collab.*, admin.*
}
```

### 2. Permission Subsets

Any user other than the organization owner receives a **subset** of permissions - a configurable collection that must be contained within their grantor's permission set.

```
Subset A ⊆ Full Superset
Subset B ⊆ Subset A
Subset C ⊆ Subset A
```

### 3. Delegation Principle

**The Golden Rule**: A user can only grant permissions they themselves possess.

```typescript
function canGrant(
  grantor: User,
  grantee: User,
  requestedPerms: Set<Permission>
): boolean {
  return requestedPerms.isSubsetOf(grantor.permissions);
}
```

This prevents privilege escalation and maintains a secure permission hierarchy.

## How It Works

### Permission Representation

Permissions are stored using **bitwise operations** for fast checking:

```typescript
// Each permission gets a unique bit position (0-127)
const PERMISSIONS = {
  ORG_READ: 1n << 0n, // Bit 0
  ORG_WRITE: 1n << 1n, // Bit 1
  ORG_DELETE: 1n << 2n, // Bit 2
  // ... up to 128 permissions
};

// User's permissions stored as two 64-bit integers
type PermissionBitmap = {
  low: bigint; // Bits 0-63
  high: bigint; // Bits 64-127
};
```

### Permission Checking

```typescript
// Check if user has permission
function hasPermission(userPerms: PermissionBitmap, required: bigint): boolean {
  return (userPerms.low & required) === required;
}

// Check if can delegate
function canDelegate(
  grantorPerms: PermissionBitmap,
  requestedPerms: PermissionBitmap
): boolean {
  const lowOk = (requestedPerms.low & grantorPerms.low) === requestedPerms.low;
  const highOk =
    (requestedPerms.high & grantorPerms.high) === requestedPerms.high;
  return lowOk && highOk;
}
```

## Permission Hierarchy Example

```
Organization: Acme Corp
├─ Owner: Alice (FULL SUPERSET)
│  ├─ Can do: EVERYTHING
│  ├─ Can delegate: ANY permission
│  │
│  ├─ Grants to Bob (Administrator)
│  │  └─ Subset: {org.read, org.write, org.members.*, resource.*, data.read, data.write}
│  │     ├─ Can do: Manage members, create resources, read/write data
│  │     ├─ Cannot do: Delete org, manage billing
│  │     │
│  │     ├─ Grants to Charlie (Team Lead)
│  │     │  └─ Subset: {org.read, resource.teams.*, data.read, data.write}
│  │     │     ├─ Can do: Manage teams, read/write data
│  │     │     ├─ Cannot do: Manage org members, delete org
│  │     │     │
│  │     │     ├─ Grants to Diana (Developer)
│  │     │     │  └─ Subset: {resource.teams.read, data.read, data.write}
│  │     │     │     ├─ Can do: View teams, read/write data
│  │     │     │     ├─ Cannot do: Create/delete teams
│  │     │     │
│  │     │     └─ Tries to grant to Eve
│  │     │        └─ Requested: {org.billing.read} ❌ DENIED
│  │     │           (Charlie doesn't have org.billing.read)
│  │     │
│  │     └─ Grants to Frank (Data Analyst)
│  │        └─ Subset: {org.read, data.read, data.export}
│  │           ├─ Can do: View org, read data, export data
│  │           ├─ Cannot do: Write data, manage resources
│  │
│  └─ Grants to Grace (Billing Manager)
│     └─ Subset: {org.read, org.billing.*}
│        ├─ Can do: View org, manage billing
│        ├─ Cannot do: Manage members, create resources
```

## Permission Domains

### Organization Domain (`org.*`)

Controls organization-level operations:

- `org.read` - View organization info
- `org.write` - Update organization settings
- `org.delete` - Delete organization (owner only typically)
- `org.transfer` - Transfer ownership
- `org.members.*` - Member management
- `org.billing.*` - Billing management
- `org.settings.*` - Settings management

### Resource Domain (`resource.*`)

Controls resource (teams, repos, projects) operations:

- `resource.{type}.create` - Create new resources
- `resource.{type}.read` - View resources
- `resource.{type}.update` - Modify resources
- `resource.{type}.delete` - Delete resources
- `resource.{type}.permissions.*` - Manage resource permissions

### Data Domain (`data.*`)

Controls data operations:

- `data.read` - Read data
- `data.write` - Write/modify data
- `data.delete` - Delete data
- `data.export` - Export data
- `data.import` - Import data

### Collaboration Domain (`collab.*`)

Controls collaboration features:

- `collab.issues.*` - Issue management
- `collab.prs.*` - Pull request operations
- `collab.comments.*` - Comment management

### Admin Domain (`admin.*`)

Controls administrative operations:

- `admin.users.*` - User administration
- `admin.audit.*` - Audit log access
- `admin.webhooks.*` - Webhook management

## Use Cases

### Use Case 1: Delegating Team Management

**Scenario**: Alice (owner) wants Bob to manage the engineering team.

```typescript
// Alice's permissions (owner)
const alicePerms = FULL_SUPERSET;

// Alice grants Bob team management permissions
await permissionService.grant(
  aliceId, // Grantor
  bobId, // Grantee
  orgId,
  [
    "resource.teams.create",
    "resource.teams.read",
    "resource.teams.update",
    "resource.teams.delete",
  ],
  "team", // Resource type
  teamId // Specific team (optional)
);

// Result: Bob can now manage the engineering team
// Bob CANNOT grant permissions he doesn't have (e.g., org.billing.read)
```

### Use Case 2: Temporary Access

**Scenario**: Give contractor temporary data export access.

```typescript
await permissionService.grant(
  aliceId,
  contractorId,
  orgId,
  ["data.read", "data.export"],
  null,
  null,
  {
    expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  }
);

// After 30 days, permissions automatically expire
```

### Use Case 3: Custom Roles

**Scenario**: Create a "Content Manager" role.

```typescript
// Create custom role
const contentManagerRole = await roleService.create(orgId, {
  name: "Content Manager",
  permissions: [
    "org.read",
    "resource.projects.read",
    "resource.projects.update",
    "data.read",
    "data.write",
    "collab.issues.read",
    "collab.issues.write",
  ],
});

// Assign role to user
await permissionService.assignRole(userId, contentManagerRole.id, orgId);

// User now has all permissions in the role
```

### Use Case 4: Resource-Scoped Permissions

**Scenario**: Give someone access to only one repository.

```typescript
await permissionService.grant(
  aliceId,
  developerId,
  orgId,
  ["data.read", "data.write"],
  "repository", // Scoped to repository resource type
  "repo-123" // Specific repository
);

// Developer can only read/write data in repo-123
// No access to other repositories
```

## Security Properties

### 1. **No Privilege Escalation**

Users cannot grant permissions they don't have.

```typescript
// Bob has: {org.read, resource.teams.*}
// Bob tries to grant: {org.billing.write}
// Result: ❌ DENIED - Bob doesn't have org.billing.write
```

### 2. **Transitive Delegation**

Permissions flow down the chain.

```
Alice → Bob → Charlie → Diana
  ↓       ↓       ↓       ↓
 100%    80%     50%     25%
```

Each level can only grant subsets of what they have.

### 3. **Audit Trail**

All permission grants/revokes are logged.

```sql
SELECT * FROM permission_delegations
WHERE organization_id = 'org-123'
ORDER BY created_at DESC;
```

### 4. **Token Invalidation**

When permissions change, user tokens are invalidated to force refresh with new permissions.

### 5. **Permission Expiration**

Temporary access automatically expires.

## API Examples

### Check Permission

```typescript
GET /orgs/:orgId/permissions/check
Authorization: Bearer <token>
{
  "permission": "resource.teams.delete",
  "resource_type": "team",
  "resource_id": "team-456"
}

Response:
{
  "allowed": true,
  "effective_permissions": ["resource.teams.delete", "resource.teams.update", ...]
}
```

### Grant Permissions

```typescript
POST /orgs/:orgId/members/:userId/permissions
Authorization: Bearer <token>
{
  "permissions": ["data.read", "data.write"],
  "resource_type": "repository",
  "resource_id": "repo-789",
  "expires_at": 1704067200
}

Response:
{
  "success": true,
  "granted": ["data.read", "data.write"]
}
```

### List User Permissions

```typescript
GET /orgs/:orgId/members/:userId/permissions
Authorization: Bearer <token>

Response:
{
  "user_id": "user-123",
  "organization_id": "org-456",
  "is_owner": false,
  "permissions": {
    "org": ["org.read"],
    "resource": ["resource.teams.read", "resource.teams.update"],
    "data": ["data.read", "data.write"]
  },
  "roles": [
    {
      "role_id": "role-789",
      "name": "Team Lead",
      "scope": { "type": "team", "id": "team-123" }
    }
  ]
}
```

## JWT Token Structure

```json
{
  "sub": "user-123",
  "email": "bob@example.com",
  "iat": 1234567890,
  "exp": 1234568790,
  "permissions": {
    "organizations": [
      {
        "id": "org-456",
        "slug": "acme-corp",
        "perms": {
          "low": "0x000000000000003F", // Bitwise permissions
          "high": "0x0000000000000000"
        },
        "is_owner": false
      }
    ],
    "resources": [
      {
        "type": "team",
        "id": "team-789",
        "slug": "engineering",
        "perms": {
          "low": "0x00000000000000FF",
          "high": "0x0000000000000000"
        }
      }
    ]
  },
  "grants": [
    "org.read",
    "resource.teams.read",
    "resource.teams.update",
    "data.read",
    "data.write"
  ]
}
```

## Benefits of This Model

1. **Flexibility**: Define any permission granularity you need
2. **Security**: Prevent privilege escalation by design
3. **Simplicity**: Simple rule - can only grant what you have
4. **Scalability**: Bitwise operations are extremely fast
5. **Auditability**: Complete trail of who granted what to whom
6. **Customizability**: Create custom roles for any use case
7. **Scoping**: Permissions can apply org-wide or to specific resources
8. **Expiration**: Support temporary access grants
9. **Composability**: Combine permissions from roles and direct grants

## Migration Path

If you need to map from traditional role names:

```typescript
const ROLE_MAPPINGS = {
  owner: FULL_SUPERSET,
  admin: [
    "org.read",
    "org.write",
    "org.members.*",
    "org.settings.*",
    "resource.*",
    "data.read",
    "data.write",
    "collab.*",
  ],
  member: ["org.read", "resource.*.read", "data.read", "collab.*"],
  billing_manager: ["org.read", "org.billing.*"],
};
```

This allows backward compatibility while moving to the more flexible superset model.
