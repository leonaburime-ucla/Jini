from __future__ import annotations

from datetime import datetime, timedelta, timezone

from src.failover_control_plane import (
    AbandonmentCertificate,
    AckPhase,
    CapacityIndex,
    CapacityPlan,
    CapacityPlanner,
    CommandEnvelope,
    CommandIntent,
    ControlPlane,
    FamilyLedger,
    FencingTokenManager,
    HealthProbeAggregator,
    LeaseToken,
    MembershipJournal,
    MembershipView,
    OperationJournal,
    PolicyRollout,
    PolicySnapshot,
    QuorumMath,
    ReconfigPlan,
    RegionCapacity,
    RegionState,
    SharedPoolLedger,
    Witness,
)


NOW = datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc)


def test_quorum_math_majority() -> None:
    view = MembershipView("v1", 1, frozenset({"us", "eu", "ap"}), NOW)
    assert QuorumMath.majority(view) == 2
    assert QuorumMath.reached(view, {"us", "eu"})
    assert not QuorumMath.reached(view, {"us"})


def test_membership_journal_installs_survivor_view() -> None:
    journal = MembershipJournal()
    old_view = MembershipView("v1", 1, frozenset({"us", "eu", "ap"}), NOW)
    journal.views["enterprise"] = old_view

    plan = ReconfigPlan(
        plan_id="p1",
        cohort="enterprise",
        old_view=old_view,
        target_regions=frozenset({"us", "eu"}),
        epoch=2,
        created_at=NOW,
    )
    assert journal.install_survivor_view(plan, {"us", "eu"})
    assert journal.current_view("enterprise").regions == frozenset({"us", "eu"})


def test_fencing_rejects_old_epoch() -> None:
    mgr = FencingTokenManager()
    old = mgr.issue("enterprise", "us-east")
    _current = mgr.issue("enterprise", "eu-west")
    assert not mgr.validate(old, now=NOW)


def test_fencing_validates_current_token() -> None:
    mgr = FencingTokenManager()
    token = mgr.issue("enterprise", "us-east", ttl_seconds=60)
    assert mgr.validate(token, now=NOW)


def test_assignment_write_requires_valid_token() -> None:
    plane = ControlPlane()
    plane.seed_membership("enterprise", {"us-east", "eu-west", "ap-south"})
    plane.seed_assignment("t1", "enterprise", "us-east")

    stale_token = LeaseToken("enterprise", "us-east", epoch=0, expires_at=NOW)
    from src.failover_control_plane import TenantAssignment

    result = plane.assignments.write_assignment(
        TenantAssignment("t1", "enterprise", "eu-west", 99, NOW), stale_token
    )
    assert result is False
    assert plane.assignments.assignments["t1"].region == "us-east"


def test_read_assignments_checks_cohort_scope() -> None:
    plane = ControlPlane()
    plane.seed_membership("enterprise", {"us-east", "eu-west"})
    plane.seed_assignment("t1", "enterprise", "us-east")

    token_other = plane.tokens.issue("standard", "us-east")
    result = plane.assignments.read_assignments_fenced("enterprise", token_other)
    assert result is None


def test_policy_rollout_commits_on_durable_quorum() -> None:
    plane = ControlPlane()
    plane.seed_membership("enterprise", {"us-east", "eu-west", "ap-south"})
    snapshot = PolicySnapshot("snap-1", 3, "enterprise", tuple(), 2, NOW)

    plane.acks.record_ack("snap-1", "us-east", AckPhase.DURABLE, 3)
    plane.acks.record_ack("snap-1", "eu-west", AckPhase.DURABLE, 3)

    assert plane.policy_rollout.commit_if_durable(snapshot)
    assert plane.policy_store.committed["enterprise"].snapshot_id == "snap-1"


def test_policy_rollout_promote_requires_serving_quorum() -> None:
    plane = ControlPlane()
    plane.seed_membership("enterprise", {"us-east", "eu-west", "ap-south"})
    snapshot = PolicySnapshot("snap-1", 3, "enterprise", tuple(), 2, NOW)

    plane.acks.record_ack("snap-1", "us-east", AckPhase.SERVING, 3)
    assert not plane.policy_rollout.promote_to_serving(snapshot)

    plane.acks.record_ack("snap-1", "eu-west", AckPhase.SERVING, 3)
    assert plane.policy_rollout.promote_to_serving(snapshot)


def test_operation_journal_deduplicates() -> None:
    plane = ControlPlane()
    plane.seed_membership("enterprise", {"us-east", "eu-west", "ap-south"})
    plane.seed_assignment("t1", "enterprise", "us-east")

    env = CommandEnvelope(
        operation_id="op-1",
        cohort="enterprise",
        intent=CommandIntent(
            action="failover_start",
            target_region="eu-west",
            public_effect="region_move",
        ),
        source_region="us-east",
        issued_at=NOW,
    )

    r1 = plane.execute_command(env)
    r2 = plane.execute_command(env)
    assert r1.outcome == "failover_complete"
    assert r2.operation_id == r1.operation_id


def test_capacity_planner_rejects_insufficient() -> None:
    index = CapacityIndex()
    index.register(
        RegionCapacity("eu-west", total_units=100, used_units=90, families={"ssd": 5})
    )
    planner = CapacityPlanner(index, SharedPoolLedger(), FamilyLedger())
    plan = CapacityPlan(
        plan_id="cp1",
        cohort="enterprise",
        target_region="eu-west",
        by_family={"ssd": 10},
        shared_spillover=5,
        lease_token=LeaseToken("enterprise", "eu-west", 1, NOW + timedelta(seconds=30)),
    )
    assert not planner.reserve(plan)


def test_capacity_planner_accepts_sufficient() -> None:
    index = CapacityIndex()
    index.register(
        RegionCapacity(
            "eu-west", total_units=200, used_units=50, families={"ssd": 30, "hdd": 80}
        )
    )
    planner = CapacityPlanner(index, SharedPoolLedger(), FamilyLedger())
    plan = CapacityPlan(
        plan_id="cp2",
        cohort="enterprise",
        target_region="eu-west",
        by_family={"ssd": 10},
        shared_spillover=20,
        lease_token=LeaseToken("enterprise", "eu-west", 1, NOW + timedelta(seconds=30)),
    )
    assert planner.reserve(plan)


def test_failure_detector_requires_witness_quorum() -> None:
    plane = ControlPlane()
    plane.seed_membership("enterprise", {"us-east", "eu-west", "ap-south"})

    witnesses = [
        Witness("eu-west", NOW, None, True, 1),
        Witness("ap-south", NOW, None, True, 1),
    ]
    cert = plane.detector.abandonment_certificate(
        "enterprise", "us-east", witnesses, current_epoch=1
    )
    assert cert is not None
    assert cert.source == "us-east"


def test_failure_detector_rejects_insufficient_witnesses() -> None:
    plane = ControlPlane()
    plane.seed_membership("enterprise", {"us-east", "eu-west", "ap-south"})

    witnesses = [Witness("eu-west", NOW, None, True, 1)]
    cert = plane.detector.abandonment_certificate(
        "enterprise", "us-east", witnesses, current_epoch=1
    )
    assert cert is None


def test_health_probe_aggregator_windows_samples() -> None:
    agg = HealthProbeAggregator(failure_threshold=2, window_seconds=60)
    old = NOW - timedelta(seconds=120)
    recent = NOW - timedelta(seconds=10)

    samples = [
        Witness("us-east", old, None, True, 1),
        Witness("us-east", old, None, True, 1),
        Witness("us-east", recent, 50, True, 1),
    ]
    states = agg.aggregate(samples, now=NOW)
    assert states.get("us-east") == RegionState.ACTIVE


def test_incident_timeline_orders_by_epoch_then_clock() -> None:
    plane = ControlPlane()
    plane.timeline.add("eu-west", "shift", epoch=2, sequence=1, wall_clock=NOW)
    plane.timeline.add(
        "us-east", "drain", epoch=1, sequence=3, wall_clock=NOW + timedelta(seconds=5)
    )

    lines = plane.timeline.describe()
    assert "us-east drain" in lines[0]
    assert "eu-west shift" in lines[1]


def test_joint_reconfiguration_requires_both_quorums() -> None:
    journal = MembershipJournal()
    old_view = MembershipView("v1", 1, frozenset({"us", "eu", "ap"}), NOW)
    journal.views["enterprise"] = old_view

    plan = ReconfigPlan(
        plan_id="p2",
        cohort="enterprise",
        old_view=old_view,
        target_regions=frozenset({"us", "eu"}),
        epoch=2,
        created_at=NOW,
    )
    assert not journal.ready_for_destructive_epoch(plan, {"us"}, {"us", "eu"})
    assert journal.ready_for_destructive_epoch(plan, {"us", "eu"}, {"us", "eu"})
