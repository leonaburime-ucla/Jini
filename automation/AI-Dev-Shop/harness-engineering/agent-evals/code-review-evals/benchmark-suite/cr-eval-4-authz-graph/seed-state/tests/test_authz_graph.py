"""Tests for multi-tenant authorization graph."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from src.authz_graph import (
    AccessDecisionService,
    AuditLog,
    AuthorizationGraph,
    DelegationEdge,
    HealthCheck,
    InMemoryResourceStore,
    IncidentAccessManager,
    Permission,
    PolicyEnvelope,
    Resource,
    RoleAssignment,
    TenantPolicyManager,
    bounded_role_walk,
)


def make_graph(cache_ttl: float = 300.0) -> AuthorizationGraph:
    return AuthorizationGraph(audit=AuditLog(), cache_ttl=cache_ttl)


def make_resource(tenant_id: str = "tenant-a", resource_id: str = "res-001") -> Resource:
    return Resource(
        resource_id=resource_id,
        tenant_id=tenant_id,
        resource_type="support_case",
        sensitivity="restricted",
    )


class TestDirectAccess:
    def test_same_tenant_assignment_grants_access(self) -> None:
        graph = make_graph()
        graph.add_assignment(RoleAssignment(
            user_id="agent-1",
            tenant_id="tenant-a",
            role_id="support_agent",
            permissions=frozenset({Permission.SUPPORT_READ}),
        ))

        assert graph.can_access("agent-1", make_resource(), Permission.SUPPORT_READ) is True

    def test_cross_tenant_assignment_denied(self) -> None:
        graph = make_graph()
        graph.add_assignment(RoleAssignment(
            user_id="agent-1",
            tenant_id="tenant-b",
            role_id="support_agent",
            permissions=frozenset({Permission.SUPPORT_READ}),
        ))

        assert graph.can_access("agent-1", make_resource("tenant-a"), Permission.SUPPORT_READ) is False

    def test_missing_permission_denied(self) -> None:
        graph = make_graph()
        graph.add_assignment(RoleAssignment(
            user_id="agent-1",
            tenant_id="tenant-a",
            role_id="support_agent",
            permissions=frozenset({Permission.SUPPORT_READ}),
        ))

        assert graph.can_access("agent-1", make_resource(), Permission.WRITE) is False

    def test_expired_assignment_denied(self) -> None:
        graph = make_graph()
        past = datetime.now(timezone.utc) - timedelta(hours=1)
        graph.add_assignment(RoleAssignment(
            user_id="agent-1",
            tenant_id="tenant-a",
            role_id="temp_role",
            permissions=frozenset({Permission.SUPPORT_READ}),
            expires_at=past,
        ))

        assert graph.can_access("agent-1", make_resource(), Permission.SUPPORT_READ) is False


class TestDelegation:
    def test_same_tenant_delegation_grants_access(self) -> None:
        graph = make_graph()
        graph.add_assignment(RoleAssignment(
            user_id="agent-1",
            tenant_id="tenant-a",
            role_id="team_lead",
            permissions=frozenset(),
        ))
        graph.add_delegation_edge(DelegationEdge(
            from_role="team_lead",
            to_role="support_reader",
            tenant_id="tenant-a",
            permissions=frozenset({Permission.SUPPORT_READ}),
        ))

        assert graph.can_access("agent-1", make_resource(), Permission.SUPPORT_READ) is True

    def test_delegation_chain_resolves(self) -> None:
        graph = make_graph()
        graph.add_assignment(RoleAssignment(
            user_id="agent-1",
            tenant_id="tenant-a",
            role_id="director",
            permissions=frozenset(),
        ))
        graph.add_delegation_edge(DelegationEdge(
            from_role="director",
            to_role="manager",
            tenant_id="tenant-a",
            permissions=frozenset(),
        ))
        graph.add_delegation_edge(DelegationEdge(
            from_role="manager",
            to_role="reader",
            tenant_id="tenant-a",
            permissions=frozenset({Permission.SUPPORT_READ}),
        ))

        assert graph.can_access("agent-1", make_resource(), Permission.SUPPORT_READ) is True


class TestBreakGlass:
    def test_break_glass_grants_same_tenant_access(self) -> None:
        graph = make_graph()
        graph.grant_break_glass(
            user_id="incident-lead",
            tenant_id="tenant-a",
            permission=Permission.INCIDENT_ACCESS,
            reason="SEV-1 customer outage",
        )

        assert graph.can_access(
            "incident-lead", make_resource(), Permission.INCIDENT_ACCESS
        ) is True

    def test_break_glass_denied_cross_tenant(self) -> None:
        graph = make_graph()
        graph.grant_break_glass(
            user_id="incident-lead",
            tenant_id="tenant-a",
            permission=Permission.INCIDENT_ACCESS,
            reason="SEV-1 customer outage",
        )

        assert graph.can_access(
            "incident-lead", make_resource("tenant-b"), Permission.INCIDENT_ACCESS
        ) is False

    def test_break_glass_records_audit(self) -> None:
        graph = make_graph()
        graph.grant_break_glass(
            user_id="incident-lead",
            tenant_id="tenant-a",
            permission=Permission.INCIDENT_ACCESS,
            reason="SEV-1 customer outage",
        )

        entries = graph._audit.entries_for_user("incident-lead")
        assert len(entries) >= 1
        assert entries[0].reason.startswith("break_glass_granted")


class TestPolicyEnvelope:
    def test_valid_policy_allows_access(self) -> None:
        graph = make_graph()
        graph.add_assignment(RoleAssignment(
            user_id="agent-1",
            tenant_id="tenant-a",
            role_id="support_agent",
            permissions=frozenset({Permission.SUPPORT_READ}),
        ))

        result = graph.can_access(
            "agent-1",
            make_resource(),
            Permission.SUPPORT_READ,
            policy_payload={
                "policy_id": "pol-1",
                "version": 3,
                "tenant_scope": "tenant-a",
                "permissions": [Permission.SUPPORT_READ],
            },
        )
        assert result is True

    def test_policy_without_permission_denies(self) -> None:
        graph = make_graph()
        graph.add_assignment(RoleAssignment(
            user_id="agent-1",
            tenant_id="tenant-a",
            role_id="support_agent",
            permissions=frozenset({Permission.SUPPORT_READ}),
        ))

        result = graph.can_access(
            "agent-1",
            make_resource(),
            Permission.SUPPORT_READ,
            policy_payload={
                "policy_id": "pol-1",
                "version": 3,
                "tenant_scope": "tenant-a",
                "permissions": [Permission.WRITE],
            },
        )
        assert result is False


class TestCaching:
    def test_repeated_access_uses_cache(self) -> None:
        graph = make_graph()
        graph.add_assignment(RoleAssignment(
            user_id="agent-1",
            tenant_id="tenant-a",
            role_id="support_agent",
            permissions=frozenset({Permission.SUPPORT_READ}),
        ))

        graph.can_access("agent-1", make_resource(), Permission.SUPPORT_READ)
        graph.can_access("agent-1", make_resource(), Permission.SUPPORT_READ)

        assert graph.metrics.cache_hits == 1

    def test_cache_returns_correct_decision(self) -> None:
        graph = make_graph()
        graph.add_assignment(RoleAssignment(
            user_id="agent-1",
            tenant_id="tenant-a",
            role_id="support_agent",
            permissions=frozenset({Permission.SUPPORT_READ}),
        ))

        first = graph.can_access("agent-1", make_resource(), Permission.SUPPORT_READ)
        second = graph.can_access("agent-1", make_resource(), Permission.SUPPORT_READ)

        assert first is True
        assert second is True


class TestRevocation:
    def test_revoke_removes_assignment(self) -> None:
        graph = make_graph()
        graph.add_assignment(RoleAssignment(
            user_id="agent-1",
            tenant_id="tenant-a",
            role_id="support_agent",
            permissions=frozenset({Permission.SUPPORT_READ}),
        ))

        removed = graph.revoke_assignment("agent-1", "support_agent", "tenant-a")
        assert removed == 1


class TestBoundedWalk:
    def test_bounded_walk_respects_depth(self) -> None:
        edges = [
            DelegationEdge(from_role="r0", to_role="r1", tenant_id="tenant-a",
                           permissions=frozenset()),
            DelegationEdge(from_role="r1", to_role="r2", tenant_id="tenant-a",
                           permissions=frozenset()),
            DelegationEdge(from_role="r2", to_role="r3", tenant_id="tenant-a",
                           permissions=frozenset()),
            DelegationEdge(from_role="r3", to_role="r4", tenant_id="tenant-a",
                           permissions=frozenset()),
        ]

        result = bounded_role_walk(edges, "r0", "tenant-a", max_depth=2)
        assert "r1" in result
        assert "r2" in result
        assert "r4" not in result

    def test_bounded_walk_filters_tenant(self) -> None:
        edges = [
            DelegationEdge(from_role="r0", to_role="r1", tenant_id="tenant-a",
                           permissions=frozenset()),
            DelegationEdge(from_role="r0", to_role="r2", tenant_id="tenant-b",
                           permissions=frozenset()),
        ]

        result = bounded_role_walk(edges, "r0", "tenant-a", max_depth=4)
        assert "r1" in result
        assert "r2" not in result

    def test_bounded_walk_respects_max_edges(self) -> None:
        edges = [
            DelegationEdge(from_role=f"r{i}", to_role=f"r{i+1}", tenant_id="tenant-a",
                           permissions=frozenset())
            for i in range(20)
        ]

        result = bounded_role_walk(edges, "r0", "tenant-a", max_depth=50, max_edges=5)
        assert len(result) <= 5


class TestIncidentAccess:
    def test_grant_incident_access_creates_assignments(self) -> None:
        graph = make_graph()
        manager = IncidentAccessManager(graph)

        grants = manager.grant_incident_access(
            user_id="responder-1",
            tenant_id="tenant-a",
            incident_id="INC-001",
            permissions=[Permission.SUPPORT_READ, Permission.SUPPORT_WRITE],
            reason="investigating latency spike",
        )

        assert len(grants) == 2
        assert graph.can_access("responder-1", make_resource(), Permission.SUPPORT_READ) is True

    def test_revoke_incident_access_removes_grants(self) -> None:
        graph = make_graph()
        manager = IncidentAccessManager(graph)

        manager.grant_incident_access(
            user_id="responder-1",
            tenant_id="tenant-a",
            incident_id="INC-001",
            permissions=[Permission.SUPPORT_READ],
            reason="investigating",
        )

        revoked = manager.revoke_incident_access("responder-1", "INC-001")
        assert revoked >= 1


class TestHealthCheck:
    def test_health_check_reports_status(self) -> None:
        graph = make_graph()
        health = HealthCheck(graph)

        status = health.full_status()
        assert status["healthy"] is True
        assert "cache" in status
        assert "graph" in status
