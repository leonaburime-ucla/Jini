"""
Multi-tenant authorization graph for SaaS permission evaluation.

Supports direct role assignments, delegated group relations, break-glass
emergency access, external policy envelopes, and decision caching.
"""
from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Protocol


class Permission:
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    ADMIN = "admin"
    SUPPORT_READ = "support:read"
    SUPPORT_WRITE = "support:write"
    INCIDENT_ACCESS = "incident:access"


@dataclass(frozen=True)
class Resource:
    resource_id: str
    tenant_id: str
    resource_type: str
    sensitivity: str = "standard"


@dataclass(frozen=True)
class RoleAssignment:
    user_id: str
    tenant_id: str
    role_id: str
    permissions: frozenset[str]
    delegated_from: str | None = None
    expires_at: datetime | None = None
    reason: str | None = None


@dataclass(frozen=True)
class PolicyEnvelope:
    policy_id: str
    version: int
    tenant_scope: str
    permissions: frozenset[str]
    effective_at: datetime | None = None

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> PolicyEnvelope:
        return cls(
            policy_id=str(payload["policy_id"]),
            version=int(payload.get("version", 1)),
            tenant_scope=str(payload.get("tenant_scope", "*")),
            permissions=frozenset(str(p) for p in payload.get("permissions", [])),
            effective_at=None,
        )


@dataclass(frozen=True)
class DelegationEdge:
    from_role: str
    to_role: str
    tenant_id: str
    permissions: frozenset[str]
    created_by: str = "system"


@dataclass
class AuditEntry:
    user_id: str
    resource_id: str
    tenant_id: str
    permission: str
    allowed: bool
    reason: str
    timestamp: float


class AuditLog:
    def __init__(self, clock: Callable[[], float] | None = None) -> None:
        self._clock = clock or time.time
        self._entries: list[AuditEntry] = []

    def record(
        self,
        user_id: str,
        resource: Resource,
        permission: str,
        allowed: bool,
        reason: str,
    ) -> None:
        self._entries.append(
            AuditEntry(
                user_id=user_id,
                resource_id=resource.resource_id,
                tenant_id=resource.tenant_id,
                permission=permission,
                allowed=allowed,
                reason=reason,
                timestamp=self._clock(),
            )
        )

    @property
    def entries(self) -> list[AuditEntry]:
        return list(self._entries)

    def entries_for_user(self, user_id: str) -> list[AuditEntry]:
        return [e for e in self._entries if e.user_id == user_id]

    def allowed_entries(self) -> list[AuditEntry]:
        return [e for e in self._entries if e.allowed]


class ResourceStore(Protocol):
    def get(self, resource_id: str, tenant_id: str) -> Resource | None: ...


class PolicyService(Protocol):
    def get_active_policy(self, tenant_id: str) -> dict[str, Any] | None: ...


@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    evictions: int = 0

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        if total == 0:
            return 0.0
        return self.hits / total


class DecisionCache:
    def __init__(self, max_size: int = 10_000, ttl_seconds: float = 300.0,
                 clock: Callable[[], float] | None = None) -> None:
        self._max_size = max_size
        self._ttl = ttl_seconds
        self._clock = clock or time.time
        self._store: dict[tuple[str, str, str], tuple[bool, float]] = {}
        self.stats = CacheStats()

    def _make_key(self, user_id: str, resource_id: str, permission: str) -> tuple[str, str, str]:
        return (user_id, resource_id, permission)

    def get(self, user_id: str, resource_id: str, permission: str) -> bool | None:
        key = self._make_key(user_id, resource_id, permission)
        entry = self._store.get(key)
        if entry is None:
            self.stats.misses += 1
            return None
        decision, stored_at = entry
        if self._clock() - stored_at > self._ttl:
            del self._store[key]
            self.stats.evictions += 1
            self.stats.misses += 1
            return None
        self.stats.hits += 1
        return decision

    def put(self, user_id: str, resource_id: str, permission: str, decision: bool) -> None:
        if len(self._store) >= self._max_size:
            oldest_key = min(self._store, key=lambda k: self._store[k][1])
            del self._store[oldest_key]
            self.stats.evictions += 1
        key = self._make_key(user_id, resource_id, permission)
        self._store[key] = (decision, self._clock())

    def invalidate_user(self, user_id: str) -> int:
        keys_to_remove = [k for k in self._store if k[0] == user_id]
        for k in keys_to_remove:
            del self._store[k]
        return len(keys_to_remove)

    def clear(self) -> None:
        self._store.clear()

    @property
    def size(self) -> int:
        return len(self._store)


@dataclass
class GraphMetrics:
    evaluations: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    delegation_walks: int = 0
    max_walk_depth: int = 0
    total_walk_edges: int = 0

    @property
    def avg_edges_per_walk(self) -> float:
        if self.delegation_walks == 0:
            return 0.0
        return self.total_walk_edges / self.delegation_walks


class AuthorizationGraph:
    def __init__(
        self,
        audit: AuditLog,
        clock: Callable[[], float] | None = None,
        cache_ttl: float = 300.0,
        cache_max_size: int = 10_000,
    ) -> None:
        self._clock = clock or time.time
        self._assignments: list[RoleAssignment] = []
        self._delegation_edges: list[DelegationEdge] = []
        self._policies: dict[str, PolicyEnvelope] = {}
        self._decision_cache = DecisionCache(
            max_size=cache_max_size, ttl_seconds=cache_ttl, clock=self._clock
        )
        self._audit = audit
        self._policy_version: int = 1
        self.metrics = GraphMetrics()

    def add_assignment(self, assignment: RoleAssignment) -> None:
        self._assignments.append(assignment)

    def add_delegation_edge(self, edge: DelegationEdge) -> None:
        self._delegation_edges.append(edge)

    def bulk_load_assignments(self, assignments: list[RoleAssignment]) -> int:
        loaded = 0
        for a in assignments:
            self._assignments.append(a)
            loaded += 1
        return loaded

    def bulk_load_edges(self, edges: list[DelegationEdge]) -> int:
        loaded = 0
        for e in edges:
            self._delegation_edges.append(e)
            loaded += 1
        return loaded

    def set_policy(self, tenant_id: str, payload: dict[str, Any]) -> None:
        envelope = PolicyEnvelope.from_payload(payload)
        self._policies[tenant_id] = envelope
        self._policy_version += 1

    def grant_break_glass(
        self,
        user_id: str,
        tenant_id: str,
        permission: str,
        reason: str,
        duration_minutes: int = 30,
    ) -> RoleAssignment:
        now = datetime.now(timezone.utc)
        assignment = RoleAssignment(
            user_id=user_id,
            tenant_id=tenant_id,
            role_id="break_glass_emergency",
            permissions=frozenset({permission}),
            expires_at=now + timedelta(minutes=duration_minutes),
            reason=reason,
        )
        self._assignments.append(assignment)
        self._audit.record(
            user_id,
            Resource(resource_id="system", tenant_id=tenant_id,
                     resource_type="break_glass", sensitivity="critical"),
            permission,
            True,
            f"break_glass_granted: {reason}",
        )
        return assignment

    def revoke_assignment(self, user_id: str, role_id: str, tenant_id: str) -> int:
        original_count = len(self._assignments)
        self._assignments = [
            a for a in self._assignments
            if not (a.user_id == user_id and a.role_id == role_id
                    and a.tenant_id == tenant_id)
        ]
        removed = original_count - len(self._assignments)
        return removed

    def can_access(
        self,
        user_id: str,
        resource: Resource,
        permission: str,
        policy_payload: dict[str, Any] | None = None,
    ) -> bool:
        self.metrics.evaluations += 1

        cached = self._decision_cache.get(user_id, resource.resource_id, permission)
        if cached is not None:
            self.metrics.cache_hits += 1
            return cached

        self.metrics.cache_misses += 1

        policy = self._resolve_policy(resource.tenant_id, policy_payload)
        if policy is not None:
            if permission not in policy.permissions:
                self._record_and_cache(user_id, resource, permission, False, "policy_denied")
                return False
            if policy.tenant_scope not in ("*", resource.tenant_id):
                self._record_and_cache(user_id, resource, permission, False, "policy_scope_mismatch")
                return False

        allowed = self._has_direct_permission(user_id, resource, permission)
        if not allowed:
            allowed = self._walk_delegations(user_id, resource, permission)

        reason = "granted_by_role" if allowed else "no_matching_permission"
        self._record_and_cache(user_id, resource, permission, allowed, reason)
        return allowed

    def fetch_resource(self, resource_id: str, tenant_id: str,
                       store: ResourceStore) -> Resource | None:
        return store.get(resource_id, tenant_id)

    def _resolve_policy(
        self, tenant_id: str, payload: dict[str, Any] | None
    ) -> PolicyEnvelope | None:
        if payload is not None:
            return PolicyEnvelope.from_payload(payload)
        return self._policies.get(tenant_id)

    def _record_and_cache(
        self,
        user_id: str,
        resource: Resource,
        permission: str,
        allowed: bool,
        reason: str,
    ) -> None:
        self._audit.record(user_id, resource, permission, allowed, reason)
        self._decision_cache.put(user_id, resource.resource_id, permission, allowed)

    def _has_direct_permission(
        self,
        user_id: str,
        resource: Resource,
        permission: str,
    ) -> bool:
        now = datetime.now(timezone.utc)
        for assignment in self._assignments:
            if assignment.user_id != user_id:
                continue
            if assignment.tenant_id != resource.tenant_id:
                continue
            if assignment.expires_at is not None and assignment.expires_at < now:
                continue
            if permission in assignment.permissions:
                return True
        return False

    def _walk_delegations(
        self,
        user_id: str,
        resource: Resource,
        permission: str,
    ) -> bool:
        self.metrics.delegation_walks += 1

        user_roles = [
            a.role_id for a in self._assignments
            if a.user_id == user_id
        ]
        if not user_roles:
            return False

        visited: set[str] = set()
        frontier = list(user_roles)
        edges_traversed = 0

        while frontier:
            current_role = frontier.pop()
            if current_role in visited:
                continue
            visited.add(current_role)

            for edge in self._delegation_edges:
                if edge.from_role != current_role:
                    continue
                edges_traversed += 1
                if permission in edge.permissions:
                    self.metrics.total_walk_edges += edges_traversed
                    self.metrics.max_walk_depth = max(
                        self.metrics.max_walk_depth, len(visited)
                    )
                    return True
                frontier.append(edge.to_role)

        self.metrics.total_walk_edges += edges_traversed
        self.metrics.max_walk_depth = max(self.metrics.max_walk_depth, len(visited))
        return False

    def get_user_permissions(self, user_id: str, tenant_id: str) -> set[str]:
        permissions: set[str] = set()
        now = datetime.now(timezone.utc)
        for a in self._assignments:
            if a.user_id != user_id:
                continue
            if a.tenant_id != tenant_id:
                continue
            if a.expires_at is not None and a.expires_at < now:
                continue
            permissions.update(a.permissions)
        return permissions

    def get_effective_roles(self, user_id: str, tenant_id: str) -> list[str]:
        now = datetime.now(timezone.utc)
        return [
            a.role_id for a in self._assignments
            if a.user_id == user_id
            and a.tenant_id == tenant_id
            and (a.expires_at is None or a.expires_at >= now)
        ]


def bounded_role_walk(
    edges: list[DelegationEdge],
    start_role: str,
    tenant_id: str,
    max_depth: int = 4,
    max_edges: int = 100,
) -> list[str]:
    """Walk delegation graph with safety bounds for diagnostics."""
    result: list[str] = []
    visited: set[tuple[str, str]] = set()
    frontier: list[tuple[str, int]] = [(start_role, 0)]
    edges_seen = 0

    while frontier:
        role_id, depth = frontier.pop()
        if depth > max_depth:
            continue
        if edges_seen >= max_edges:
            break
        state = (tenant_id, role_id)
        if state in visited:
            continue
        visited.add(state)

        for edge in edges:
            if edge.tenant_id != tenant_id:
                continue
            if edge.from_role != role_id:
                continue
            edges_seen += 1
            result.append(edge.to_role)
            frontier.append((edge.to_role, depth + 1))

    return result


class TenantPolicyManager:
    def __init__(self, graph: AuthorizationGraph) -> None:
        self._graph = graph
        self._version_history: dict[str, list[int]] = {}

    def apply_policy_update(self, tenant_id: str, payload: dict[str, Any]) -> PolicyEnvelope:
        envelope = PolicyEnvelope.from_payload(payload)
        self._graph.set_policy(tenant_id, payload)
        history = self._version_history.setdefault(tenant_id, [])
        history.append(envelope.version)
        return envelope

    def get_version_history(self, tenant_id: str) -> list[int]:
        return self._version_history.get(tenant_id, [])

    def rollback_policy(self, tenant_id: str) -> bool:
        history = self._version_history.get(tenant_id)
        if not history or len(history) < 2:
            return False
        history.pop()
        return True


class IncidentAccessManager:
    def __init__(self, graph: AuthorizationGraph,
                 clock: Callable[[], float] | None = None) -> None:
        self._graph = graph
        self._clock = clock or time.time
        self._active_grants: dict[str, list[RoleAssignment]] = {}

    def grant_incident_access(
        self,
        user_id: str,
        tenant_id: str,
        incident_id: str,
        permissions: list[str],
        reason: str,
        duration_minutes: int = 30,
    ) -> list[RoleAssignment]:
        grants = []
        for perm in permissions:
            assignment = self._graph.grant_break_glass(
                user_id=user_id,
                tenant_id=tenant_id,
                permission=perm,
                reason=f"[{incident_id}] {reason}",
                duration_minutes=duration_minutes,
            )
            grants.append(assignment)

        key = f"{user_id}:{incident_id}"
        self._active_grants.setdefault(key, []).extend(grants)
        return grants

    def revoke_incident_access(self, user_id: str, incident_id: str) -> int:
        key = f"{user_id}:{incident_id}"
        grants = self._active_grants.pop(key, [])
        revoked = 0
        for g in grants:
            revoked += self._graph.revoke_assignment(
                user_id=g.user_id,
                role_id=g.role_id,
                tenant_id=g.tenant_id,
            )
        return revoked

    def list_active_grants(self, user_id: str) -> list[RoleAssignment]:
        result = []
        for key, grants in self._active_grants.items():
            if key.startswith(f"{user_id}:"):
                result.extend(grants)
        return result


class AccessDecisionService:
    def __init__(
        self,
        graph: AuthorizationGraph,
        resource_store: ResourceStore,
    ) -> None:
        self._graph = graph
        self._resource_store = resource_store

    def check_and_fetch(
        self,
        user_id: str,
        resource_id: str,
        tenant_id: str,
        permission: str,
        policy_payload: dict[str, Any] | None = None,
    ) -> tuple[bool, Resource | None]:
        resource = Resource(
            resource_id=resource_id,
            tenant_id=tenant_id,
            resource_type="unknown",
            sensitivity="standard",
        )
        allowed = self._graph.can_access(user_id, resource, permission, policy_payload)
        if not allowed:
            return False, None
        fetched = self._graph.fetch_resource(resource_id, tenant_id, self._resource_store)
        return True, fetched

    def batch_check(
        self,
        user_id: str,
        resources: list[Resource],
        permission: str,
    ) -> dict[str, bool]:
        results: dict[str, bool] = {}
        for r in resources:
            results[r.resource_id] = self._graph.can_access(user_id, r, permission)
        return results


class InMemoryResourceStore:
    def __init__(self) -> None:
        self._resources: dict[tuple[str, str], Resource] = {}

    def add(self, resource: Resource) -> None:
        self._resources[(resource.resource_id, resource.tenant_id)] = resource

    def get(self, resource_id: str, tenant_id: str) -> Resource | None:
        return self._resources.get((resource_id, tenant_id))

    def list_for_tenant(self, tenant_id: str) -> list[Resource]:
        return [r for (_, t), r in self._resources.items() if t == tenant_id]


class AssignmentLoader:
    def __init__(self, graph: AuthorizationGraph) -> None:
        self._graph = graph

    def load_from_records(self, records: list[dict[str, Any]]) -> int:
        loaded = 0
        for rec in records:
            assignment = RoleAssignment(
                user_id=str(rec["user_id"]),
                tenant_id=str(rec["tenant_id"]),
                role_id=str(rec["role_id"]),
                permissions=frozenset(rec.get("permissions", [])),
                delegated_from=rec.get("delegated_from"),
                expires_at=rec.get("expires_at"),
                reason=rec.get("reason"),
            )
            self._graph.add_assignment(assignment)
            loaded += 1
        return loaded

    def load_edges_from_records(self, records: list[dict[str, Any]]) -> int:
        loaded = 0
        for rec in records:
            edge = DelegationEdge(
                from_role=str(rec["from_role"]),
                to_role=str(rec["to_role"]),
                tenant_id=str(rec["tenant_id"]),
                permissions=frozenset(rec.get("permissions", [])),
                created_by=str(rec.get("created_by", "system")),
            )
            self._graph.add_delegation_edge(edge)
            loaded += 1
        return loaded


class HealthCheck:
    def __init__(self, graph: AuthorizationGraph) -> None:
        self._graph = graph

    def cache_health(self) -> dict[str, Any]:
        return {
            "cache_size": self._graph._decision_cache.size,
            "hit_rate": self._graph._decision_cache.stats.hit_rate,
            "evictions": self._graph._decision_cache.stats.evictions,
        }

    def graph_health(self) -> dict[str, Any]:
        return {
            "total_assignments": len(self._graph._assignments),
            "total_edges": len(self._graph._delegation_edges),
            "evaluations": self._graph.metrics.evaluations,
            "avg_edges_per_walk": self._graph.metrics.avg_edges_per_walk,
        }

    def full_status(self) -> dict[str, Any]:
        return {
            "cache": self.cache_health(),
            "graph": self.graph_health(),
            "healthy": True,
        }
