# Access Control Evaluator

Build a permission evaluator for a document management system in Python.

## Requirements

1. Evaluate whether a user has permission to perform an action on a resource.
2. Permissions come from roles: each role has a list of allowed actions on resource types.
3. Users can have multiple roles — permissions are the union of all role permissions.
4. Support: canAccess(userId, action, resourceType) returning { allowed: boolean, roles: string[], reason: string }.
5. Support: grantRole(userId, roleId) and revokeRole(userId, roleId) with audit logging.
6. All grant/revoke operations must be idempotent — granting twice is a no-op, revoking a non-existent role is a no-op.
7. Audit log entries: { timestamp, userId, action, roleId, result }.

## Constraints

- Pure Python, no external dependencies except injected role service and audit logger
- Must include tests
- Clock and services must be injectable for deterministic testing
