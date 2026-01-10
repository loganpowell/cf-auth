# Test Suite Documentation

## Overview

This directory contains the comprehensive TDD (Test-Driven Development) test suite for the multi-tenant authentication and authorization platform. Tests are organized by feature area and define the expected behavior that implementation should satisfy.

**Total Test Coverage**: 100+ test cases across 11 scenario files

## Test Files

### 1. **admin-tenant-creation.test.ts** (280 lines, 9 tests)

Defines admin-level operations for platform management.

**Key Scenarios**:

- ✅ Admin authenticates with platform API key
- ✅ Admin creates new tenant with auto-generated credentials
- ✅ Admin manages hierarchical tenant relationships (parent/child)
- ✅ Validates tenant slug uniqueness (no duplicates)
- ✅ Enforces depth limits (max 5 levels of nesting)
- ✅ Assigns admin permissions to tenants
- ✅ Tracks usage metrics per tenant
- ✅ Manages credential provisioning workflow
- ✅ Audit logs all admin operations

**Test Patterns**:

- Platform-level API key authentication
- Atomic tenant creation with auto-generated keys
- Validation of constraints (unique slug, depth limit)
- Credential provisioning as separate step

### 2. **customer-schema-definition.test.ts** (350 lines, 9 tests)

Defines how customers create and manage authorization schemas.

**Key Scenarios**:

- ✅ Define entity structures (fields, types, constraints)
- ✅ Define relationships between entities (one-to-many, many-to-one)
- ✅ Define roles and their permissions
- ✅ Create ABAC (Attribute-Based Access Control) rules
- ✅ Create RLS (Row-Level Security) policies
- ✅ Validate schema structure and relationships
- ✅ Auto-generate TypeScript interfaces from schema
- ✅ Track schema versions and history
- ✅ Retrieve schema definitions by version

**Test Patterns**:

- YAML-based schema definitions
- Entity relationship modeling
- Role-based permission specification
- Dynamic type generation
- Schema versioning

### 3. **endpoint-decoration.test.ts** (410 lines, 10 tests)

Defines decorator system for applying auth/permissions to endpoints.

**Key Scenarios**:

- ✅ @Auth() - Require user authentication
- ✅ @RequirePermission() - Check specific permissions
- ✅ @Validate() - Validate request data
- ✅ @RequireABAC() - Apply ABAC rules
- ✅ @RLS() - Apply row-level security
- ✅ Decorator composition (multiple on same endpoint)
- ✅ Middleware generation from decorators
- ✅ Decorator compatibility validation
- ✅ Endpoint registry and metadata storage
- ✅ OpenAPI/Swagger spec generation

**Test Patterns**:

- Python/Java-style decorators in TypeScript
- Decorator composition and ordering
- Auto-generated middleware functions
- Metadata-driven security

### 4. **auth-flows.test.ts** (500 lines, 12 tests)

Defines complete authentication flows supporting various clients.

**Key Scenarios - 9 Authentication Approaches**:

1. **API Key Authentication**

   - Public keys: `pk_live_*` (frontend, public apps)
   - Secret keys: `sk_live_*` (backend, server-to-server)
   - Restricted keys: `rk_live_*` (mobile, limited scope)

2. **OAuth 2.0 Authorization Code Grant**

   - Redirect flow for third-party apps
   - Secure credential exchange
   - User consent handling

3. **Session-Based Authentication**

   - Traditional cookie-based sessions
   - HttpOnly, Secure, SameSite flags
   - Session expiry and refresh

4. **JWT Token Flow**

   - Self-contained token authentication
   - Token expiry and refresh tokens
   - Multiple signing algorithms

5. **PKCE (Proof Key for Public Clients)**

   - OAuth for mobile apps and SPAs
   - No client_secret required
   - Code challenge/verifier pattern

6. **M2M (Machine-to-Machine)**

   - Service account credentials
   - Client credentials grant flow
   - Service-to-service communication

7. **Webhooks**

   - HMAC signing for webhook authenticity
   - Signature verification
   - Timestamp validation to prevent replay

8. **MFA (Multi-Factor Authentication)**

   - TOTP (Time-Based One-Time Password)
   - SMS verification codes
   - Backup codes

9. **Token Management**
   - Token refresh (obtain new token with refresh token)
   - Token revocation (invalidate token)
   - Token introspection

**Test Patterns**:

- Each flow tested end-to-end
- Error cases (invalid credentials, expired tokens)
- Token lifecycle management

### 5. **full-workflow.test.ts** (380 lines, 5 tests)

Integration test covering complete user journey from admin to production.

**8-Phase Workflow**:

1. **Admin Setup**: Platform admin creates tenant, generates API keys
2. **Customer Provisioning**: Customer receives credentials
3. **Schema Definition**: Customer defines authorization schema
4. **Endpoint Creation**: Customer creates decorated endpoints
5. **Auth Integration**: Endpoints integrated with auth system
6. **Auth Testing**: Test all auth flows work with customer endpoints
7. **Permission Enforcement**: Verify permissions work correctly
8. **Audit Logging**: Audit trail of all operations

**Test Scenarios**:

- Multi-environment keys (development, staging, production)
- Usage metrics tracking across workflow
- Cross-tenant access prevention
- Complete end-to-end user flow

**Test Patterns**:

- Sequential phases with state passing
- Real-world usage patterns
- Integration of all subsystems

### 6. **test-helpers.ts** (150 lines)

Reusable test utilities and factory functions.

**TestDatabase Class**:

- Wrapper around better-sqlite3 for in-memory testing
- Automatic cleanup after tests
- Direct SQL access for validation

**Factory Functions**:

- `createTenant()` - Create tenant with defaults
- `createPlatformTenant()` - Special platform admin tenant
- `createAPIKey()` - Generate and store API key
- `createTenantWithKeys()` - Full setup (tenant + keys)
- `createUser()` - Create user account
- `createSession()` - Create session with expiry
- `createSchema()` - Store schema definition
- `logAuditEvent()` - Log audit trail

**Benefits**:

- Reduces test boilerplate
- DRY principle for common setup
- Consistent test data

### 7. **advanced-authorization.test.ts** (430 lines, 16 tests)

Complex authorization patterns for enterprise scenarios.

**ABAC (Attribute-Based Access Control)**:

- User attributes (department, role, team)
- Resource attributes (classification, owner, team)
- Conditional logic (OR/AND combinations)
- Time-based conditions (business hours, weekdays)
- Example: `user.department == "engineering" AND resource.classification == "public"`

**RLS (Row-Level Security)**:

- Query filtering based on user context
- Multiple conditions (ownership OR contribution OR public)
- Aggregation safety (SUM/COUNT only see own data)
- Example: Filter projects where user is owner or contributor

**Resource-Scoped Permissions**:

- Global: `read:projects` (all projects)
- Scoped: `write:project:proj:123` (specific project)
- Nested: `write:team:team:123:member` (nested scope)

**Permission Delegation**:

- Time-limited delegation with expiry
- Audit tracking of delegations
- Who can delegate what to whom

**Conditional Permissions**:

- IP-based (whitelist verification)
- Approval count (multi-approval workflows)
- State-based (only if status is X)

**Test Scenarios**: 16 test cases covering all patterns with edge cases

### 8. **schema-compilation.test.ts** (420 lines, 13 tests)

Tests for schema compiler that translates YAML → TypeScript → Database.

**Compilation Pipeline**:

1. **YAML Parsing**: Parse customer-defined schema YAML
2. **Validation**: Validate schema structure and types
3. **Type Generation**: Generate TypeScript interfaces/types
4. **ORM Compilation**: Generate Drizzle table definitions
5. **Migration Generation**: Generate SQL migrations

**Test Coverage**:

- Field type validation (string, integer, decimal, boolean, timestamp, enum, etc.)
- Entity relationships (foreign keys, cardinality)
- Constraints (PRIMARY KEY, UNIQUE, NOT NULL, DEFAULT, CHECK)
- TypeScript type generation
- Drizzle ORM compilation
- Schema versioning and migrations
- Error handling (invalid types, circular dependencies)
- Business rules validation
- Index definitions and optimization

**Test Patterns**:

- End-to-end compilation
- Error cases with helpful messages
- Schema evolution scenarios

### 9. **performance-security.test.ts** (410 lines, 18 tests)

Performance and security testing.

**Rate Limiting**:

- Track API calls per tenant
- Per-endpoint rate limiting
- Sliding window algorithm
- Plan-based limits (free, pro, enterprise)

**Query Optimization**:

- Index usage for fast lookups
- Permission cache with TTL
- Early data filtering in database
- N+1 query prevention

**Security**:

- SQL injection prevention (parameterized queries)
- API key format validation
- HTTPS enforcement for sensitive operations
- Audit logging of sensitive operations
- Secret masking in logs
- Brute force attack prevention

**Data Encryption**:

- Encryption at rest for sensitive data
- Password hashing with salt
- TLS for data in transit

**Audit Logging**:

- Log all permission changes
- Log all data access
- Immutable audit trail

### 10. **client-sdk.test.ts** (520 lines, 18 tests)

Specification for client-side SDKs.

**SDK Features**:

**Initialization**:

- Minimal configuration (tenantId, apiKey)
- Custom base URL support
- Configuration validation

**Authentication**:

- Sign in with email/password
- Sign out
- Token refresh
- Error handling

**Session Management**:

- Retrieve current session
- Check if expired
- Persist across page reloads

**User Information**:

- Get current user info
- User info caching

**Permission Checking**:

- Check single permission
- Check multiple permissions (all/any)
- Require permission or error
- Scoped permissions (resource-level)

**Event Handlers**:

- Listen to auth state changes
- Multiple listeners support
- Unsubscribe functionality

**React Hooks**:

- `useAuth()` - Get current user and signout
- `usePermission()` - Check permissions
- `ProtectedRoute` component pattern

**Error Handling**:

- Network errors
- Authentication errors
- Authorization errors
- Helpful error messages

### 11. **integration-errors.test.ts** (430 lines, 20 tests)

Integration and error handling scenarios.

**Multi-Service Integration**:

- Health checks across services
- Service dependencies
- Circuit breaker pattern

**Error Scenarios**:

- Missing required fields
- Invalid field formats
- Duplicate record prevention
- Invalid type validation
- Constraint enforcement

**Cascade Failures**:

- Prevent cascade delete without flag
- Orphaned record detection
- Temp data cleanup on error

**Validation Error Handling**:

- Collect all errors at once
- Field-specific error context
- Related field validation

**Recovery and Retry**:

- Exponential backoff retry
- Idempotency for safe retries
- Partial failure handling

**Graceful Degradation**:

- Use cache when service unavailable
- Default values for optional services
- Feature downgrade based on plan limits

## Test Architecture

### Organization Principles

- **One scenario file per feature area** - Easy to find and maintain
- **Self-contained tests** - Each test can run independently
- **DRY setup with helpers** - Reduces boilerplate
- **Clear test names** - Describe what's being tested
- **Comprehensive edge cases** - Error scenarios, boundary conditions

### Test Database

- Uses **better-sqlite3** for in-memory database
- Automatically created/destroyed per test
- Matches production schema
- No external dependencies

### Test Patterns

- **Arrange-Act-Assert** - Setup, execute, verify
- **Factory functions** - Common setup patterns
- **Pseudo-executable** - Tests can be converted to real tests
- **Specification as executable** - Tests document expected behavior

## Running Tests

### Install Dependencies

```bash
npm install --save-dev vitest better-sqlite3 @types/better-sqlite3
```

### Run All Tests

```bash
npm test
```

### Run Specific Test File

```bash
npm test admin-tenant-creation.test.ts
```

### Run With Coverage

```bash
npm test -- --coverage
```

### Watch Mode

```bash
npm test -- --watch
```

## Implementation Roadmap

These tests should drive implementation in this order:

### Phase 1: Decorators (1-2 weeks)

- Implement @Auth() decorator
- Implement @RequirePermission() decorator
- Implement decorator composition
- Tests: `endpoint-decoration.test.ts`, `auth-flows.test.ts`

### Phase 2: Schema Compiler (2-3 weeks)

- Implement YAML parser
- Implement TypeScript type generator
- Implement Drizzle compiler
- Implement migration generator
- Tests: `schema-compilation.test.ts`, `customer-schema-definition.test.ts`

### Phase 3: Authentication (2-3 weeks)

- Implement OAuth 2.0 flow
- Implement JWT tokens
- Implement PKCE flow
- Implement M2M credentials
- Tests: `auth-flows.test.ts`, `full-workflow.test.ts`

### Phase 4: Authorization Engine (2-3 weeks)

- Implement ABAC evaluator
- Implement RLS enforcer
- Implement permission scoping
- Implement delegation system
- Tests: `advanced-authorization.test.ts`, `full-workflow.test.ts`

### Phase 5: Performance & Security (1-2 weeks)

- Implement rate limiting
- Implement permission cache
- Implement security validations
- Implement audit logging
- Tests: `performance-security.test.ts`

### Phase 6: Client SDKs (2-3 weeks)

- Implement JavaScript/TypeScript SDK
- Implement React hooks
- Implement error handling
- Tests: `client-sdk.test.ts`

### Phase 7: Integration (1-2 weeks)

- Fix integration issues
- Add missing error handling
- Graceful degradation
- Tests: `integration-errors.test.ts`, `full-workflow.test.ts`

## Key Testing Principles

1. **Test-Driven Development**: Write tests first, implementation follows
2. **Specification by Example**: Tests show how features should work
3. **No Implementation Details**: Tests don't care how, only what
4. **Independent Tests**: Can run in any order, no shared state
5. **Realistic Scenarios**: Tests reflect real-world usage
6. **Edge Cases**: Tests cover error cases and boundaries
7. **Clear Assertions**: Each test has single logical assertion
8. **Fast Feedback**: Tests run quickly (in-memory database)

## Notes

- Tests are **pseudo-executable** - They describe behavior but don't run against actual implementation yet
- Once implementation is built, convert pseudo-code to actual assertions
- Some tests use comments to show expected behavior patterns
- All tests assume synchronous execution for simplicity
- Production code should handle async properly

## Next Steps

1. **Read test files** - Understand expected behavior
2. **Implement decorators** - Start with `endpoint-decoration.test.ts`
3. **Implement schema compiler** - Use `schema-compilation.test.ts` as spec
4. **Implement auth flows** - Follow `auth-flows.test.ts`
5. **Implement authorization** - Use `advanced-authorization.test.ts` as guide
6. **Build client SDK** - Match `client-sdk.test.ts` API
7. **Integration testing** - Use `full-workflow.test.ts` for end-to-end
8. **Performance & Security** - Implement features from `performance-security.test.ts`

## Contact

For questions about test structure or expected behavior, refer to the test file comments which provide context and rationale.
