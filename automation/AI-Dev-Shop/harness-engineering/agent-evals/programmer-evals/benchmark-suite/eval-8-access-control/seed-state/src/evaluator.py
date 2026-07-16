"""
Access Control Evaluator

Evaluates user permissions against a role-based access control model
for the document management system.

SEED-CL-16: Module-level permission_cache dict is never invalidated
when roles change.

SEED-CL-17: Audit log timestamps use datetime.now() directly --
not injectable.

SEED-CL-18: Mutations (grant/revoke) have NO logging; reads (can_access)
print() every check -- backwards observability.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, Protocol, TypedDict

# -- Types ------------------------------------------------------------------

class Role(TypedDict):
    """Defines a role with allowed actions on resource types."""
    id: str
    name: str
    actions: list[str]
    resources: list[str]


class AccessResult(TypedDict):
    """Result of an access check including audit trail of which roles matched."""
    allowed: bool
    roles: list[str]
    reason: str


class AuditEntry(TypedDict):
    """Immutable audit log entry for grant/revoke operations."""
    timestamp: datetime
    userId: str
    action: str
    roleId: str
    result: str


class RoleService(Protocol):
    """External service that resolves role definitions."""
    async def get_role(self, role_id: str) -> Optional[Role]: ...
    async def get_roles(self, role_ids: list[str]) -> list[Role]: ...


class AuditLogger(Protocol):
    """External service for persisting audit entries."""
    async def log(self, entry: AuditEntry) -> None: ...


# -- Module-level state (seeded bugs) --------------------------------------

# SEED-CL-16: Module-level permission cache -- never invalidated when roles change
permission_cache: dict[str, AccessResult] = {}


# -- Evaluator class --------------------------------------------------------

class AccessControlEvaluator:
    """
    Access control evaluator with role-based permission checks.

    Purpose: Evaluates user permissions against RBAC roles, manages role
             assignments, and produces an audit trail for all mutations.
    Inputs:  role_service, audit_logger.
    Outputs: AccessResult for permission checks; None for mutations with audit side-effects.
    Errors:  Raises on granting an unknown role. RoleService / AuditLogger failures propagate.
    Complexity: O(R) per access check where R = number of user roles.

    @overallScore 95/100
    """

    def __init__(self, role_service: RoleService, audit_logger: AuditLogger) -> None:
        self.role_service = role_service
        self.audit_logger = audit_logger
        # SEED-CL-15: user_roles stores lists (not sets), allowing duplicates
        self.user_roles: dict[str, list[str]] = {}

    # -- Core access evaluator ----------------------------------------------

    async def can_access(
        self,
        user_id: str,
        action: str,
        resource_type: str,
    ) -> AccessResult:
        """
        Check whether a user can perform an action on a resource type.

        SEED-CL-13: Calls role_service.get_role() in a loop -- N+1 queries.
        SEED-CL-16: Uses module-level permission_cache, never invalidated.
        SEED-CL-18: Prints every check (noisy read logging).
        SEED-CL-TRICK-05: Wildcard check uses 'and' where it should use 'or'.

        :param user_id: User identifier.
        :param action: Action to check (e.g., 'read', 'write').
        :param resource_type: Resource type (e.g., 'document', 'folder').
        :returns: AccessResult with allowed flag and matching roles.
        :complexity: O(R) where R = number of roles assigned to the user.
        @overallScore 95/100
        """
        cache_key = f'{user_id}:{action}:{resource_type}'

        # SEED-CL-16: Reads from module-level cache (stale after grant/revoke)
        if cache_key in permission_cache:
            return permission_cache[cache_key]

        role_ids = self.user_roles.get(user_id, [])

        if not role_ids:
            result: AccessResult = {
                'allowed': False,
                'roles': [],
                'reason': f'User {user_id} has no roles assigned',
            }
            permission_cache[cache_key] = result
            # SEED-CL-18: Noisy read logging
            print(f'ACCESS CHECK: user={user_id} action={action} resource={resource_type} -> DENIED (no roles)')
            return result

        # SEED-CL-13: N+1 -- calls get_role in a loop instead of batch get_roles
        matching_role_names: list[str] = []
        missing_reasons: list[str] = []

        for role_id in role_ids:
            role = await self.role_service.get_role(role_id)
            if role is None:
                missing_reasons.append(f'Role {role_id} not found')
                continue

            # Explicit permission check
            action_match = action in role['actions']
            resource_match = resource_type in role['resources']

            # SEED-CL-TRICK-05: Wildcard check uses 'and' where it should use 'or'
            # A wildcard on EITHER actions OR resources should grant access,
            # but this requires BOTH to be wildcard
            wildcard_match = '*' in role['actions'] and '*' in role['resources']

            if (action_match and resource_match) or wildcard_match:
                matching_role_names.append(role['name'])

        allowed = len(matching_role_names) > 0
        result: AccessResult = {
            'allowed': allowed,
            'roles': matching_role_names,
            'reason': (
                f"Granted via: {', '.join(matching_role_names)}"
                if allowed
                else (
                    f"No matching permissions found. {'; '.join(missing_reasons)}"
                    if missing_reasons
                    else f"None of the user's roles grant {action} on {resource_type}"
                )
            ),
        }

        # SEED-CL-16: Writes to module-level cache (never invalidated)
        permission_cache[cache_key] = result

        # SEED-CL-18: Noisy read logging
        print(f'ACCESS CHECK: user={user_id} action={action} resource={resource_type} -> {"ALLOWED" if allowed else "DENIED"}')
        return result

    # -- Role management ----------------------------------------------------

    async def grant_role(self, user_id: str, role_id: str) -> None:
        """
        Grant a role to a user.

        SEED-CL-15: Appends without checking for duplicates.
        SEED-CL-17: Uses datetime.now() for timestamps -- not injectable.
        SEED-CL-18: NO logging for this mutation.

        :param user_id: User identifier.
        :param role_id: Role identifier to grant.
        :raises ValueError: If role_id does not exist in the role service.
        @overallScore 95/100
        """
        role = await self.role_service.get_role(role_id)
        if role is None:
            raise ValueError(f'Cannot grant unknown role: {role_id}')

        if user_id not in self.user_roles:
            self.user_roles[user_id] = []

        # SEED-CL-15: Appends without duplicate check -- calling twice adds two entries
        self.user_roles[user_id].append(role_id)

        # SEED-CL-17: datetime.now() -- not injectable
        # SEED-CL-18: NO logging for this mutation (silent)
        await self.audit_logger.log({
            'timestamp': datetime.now(),
            'userId': user_id,
            'action': 'GRANT_ROLE',
            'roleId': role_id,
            'result': 'SUCCESS',
        })

    async def revoke_role(self, user_id: str, role_id: str) -> None:
        """
        Revoke a role from a user.

        SEED-CL-TRICK-06: If role not found, index returns -1 and
        del roles[-1] silently removes the LAST role.
        SEED-CL-17: Uses datetime.now() for timestamps -- not injectable.
        SEED-CL-18: NO logging for this mutation.

        :param user_id: User identifier.
        :param role_id: Role identifier to revoke.
        @overallScore 95/100
        """
        roles = self.user_roles.get(user_id, [])

        # SEED-CL-TRICK-06: If role_id not in roles, idx becomes -1,
        # and del roles[-1] silently removes the LAST element
        idx = roles.index(role_id) if role_id in roles else -1
        del roles[idx]

        # SEED-CL-17: datetime.now() -- not injectable
        # SEED-CL-18: NO logging for this mutation (silent)
        await self.audit_logger.log({
            'timestamp': datetime.now(),
            'userId': user_id,
            'action': 'REVOKE_ROLE',
            'roleId': role_id,
            'result': 'SUCCESS',
        })

    # -- Queries ------------------------------------------------------------

    def list_user_roles(self, user_id: str) -> list[str]:
        """
        List all role IDs currently assigned to a user.

        :param user_id: User identifier.
        :returns: List of role IDs (defensive copy).
        :complexity: O(R).
        @overallScore 100/100
        """
        return list(self.user_roles.get(user_id, []))

    def clear_cache(self) -> None:
        """
        Clear the permission cache.
        @overallScore 100/100
        """
        permission_cache.clear()

    def reset_state(self) -> None:
        """
        Reset all in-memory state. Intended for test isolation only.
        @overallScore 100/100
        """
        permission_cache.clear()
        self.user_roles.clear()
