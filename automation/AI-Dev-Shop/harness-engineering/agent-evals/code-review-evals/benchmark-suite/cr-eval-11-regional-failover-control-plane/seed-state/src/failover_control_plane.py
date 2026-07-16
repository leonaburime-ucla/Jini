"""Regional failover control-plane for multi-region SaaS platform."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Iterable


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RegionState(str, Enum):
    ACTIVE = "active"
    DEGRADED = "degraded"
    DRAINING = "draining"
    RECOVERING = "recovering"
    OFFLINE = "offline"


class AckPhase(str, Enum):
    RECEIVED = "received"
    DURABLE = "durable"
    SERVING = "serving"


@dataclass(frozen=True)
class MembershipView:
    view_id: str
    epoch: int
    regions: frozenset[str]
    created_at: datetime


@dataclass(frozen=True)
class LeaseToken:
    cohort: str
    owner_region: str
    epoch: int
    expires_at: datetime


@dataclass(frozen=True)
class TenantAssignment:
    tenant_id: str
    cohort: str
    region: str
    assignment_epoch: int
    updated_at: datetime


@dataclass(frozen=True)
class PolicySnapshot:
    snapshot_id: str
    version: int
    cohort: str
    conditions: tuple[dict[str, object], ...]
    schema_version: int
    created_at: datetime


@dataclass(frozen=True)
class ReconfigPlan:
    plan_id: str
    cohort: str
    old_view: MembershipView
    target_regions: frozenset[str]
    epoch: int
    created_at: datetime

    def target_view(self) -> MembershipView:
        return MembershipView(
            view_id=f"{self.plan_id}-target",
            epoch=self.epoch,
            regions=self.target_regions,
            created_at=self.created_at,
        )


@dataclass(frozen=True)
class CommandEnvelope:
    operation_id: str
    cohort: str
    intent: CommandIntent
    source_region: str
    issued_at: datetime


@dataclass(frozen=True)
class CommandIntent:
    action: str
    target_region: str
    public_effect: str
    parameters: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class CommandResult:
    operation_id: str
    cohort: str
    outcome: str
    details: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class CapacityPlan:
    plan_id: str
    cohort: str
    target_region: str
    by_family: dict[str, int]
    shared_spillover: int
    lease_token: LeaseToken


@dataclass(frozen=True)
class RegionCapacity:
    region: str
    total_units: int
    used_units: int
    families: dict[str, int] = field(default_factory=dict)

    @property
    def spare_units(self) -> int:
        return max(0, self.total_units - self.used_units)


@dataclass(frozen=True)
class Witness:
    region: str
    sampled_at: datetime
    control_plane_rtt_ms: int | None
    edge_healthy: bool
    epoch: int


@dataclass(frozen=True)
class AbandonmentCertificate:
    source: str
    epoch: int
    witnesses: frozenset[str]
    issued_at: datetime


@dataclass(frozen=True)
class WatermarkVector:
    positions: dict[str, int]

    def dominates(self, other: WatermarkVector) -> bool:
        for stream, pos in other.positions.items():
            if self.positions.get(stream, 0) < pos:
                return False
        return True


class MetricsSink:
    def __init__(self) -> None:
        self.counters: defaultdict[str, int] = defaultdict(int)
        self.gauges: dict[str, int] = {}

    def increment(self, name: str, amount: int = 1) -> None:
        self.counters[name] += amount

    def gauge(self, name: str, value: int) -> None:
        self.gauges[name] = value


# --- Quorum and Membership ---


class QuorumMath:
    @staticmethod
    def majority(view: MembershipView) -> int:
        return len(view.regions) // 2 + 1

    @staticmethod
    def reached(view: MembershipView, acks: set[str]) -> bool:
        count = len(acks & view.regions)
        return count >= QuorumMath.majority(view)


class MembershipJournal:
    def __init__(self) -> None:
        self.views: dict[str, MembershipView] = {}
        self.history: list[tuple[str, MembershipView]] = []

    def current_view(self, cohort: str) -> MembershipView | None:
        return self.views.get(cohort)

    def install_survivor_view(self, plan: ReconfigPlan, acks: set[str]) -> bool:
        """Install a new membership view after receiving target-view quorum."""
        next_view = plan.target_view()
        if not QuorumMath.reached(next_view, acks):
            return False
        self.history.append((plan.cohort, next_view))
        self.views[plan.cohort] = next_view
        return True

    def ready_for_destructive_epoch(
        self, plan: ReconfigPlan, old_acks: set[str], new_acks: set[str]
    ) -> bool:
        """Joint consensus: require quorum in BOTH old and new views."""
        return QuorumMath.reached(plan.old_view, old_acks) and QuorumMath.reached(
            plan.target_view(), new_acks
        )


# --- Fencing and Leases ---


class FencingTokenManager:
    def __init__(self) -> None:
        self._epochs: defaultdict[str, int] = defaultdict(int)
        self._lock_holders: dict[str, LeaseToken] = {}

    def issue(self, cohort: str, owner_region: str, ttl_seconds: int = 30) -> LeaseToken:
        self._epochs[cohort] += 1
        token = LeaseToken(
            cohort=cohort,
            owner_region=owner_region,
            epoch=self._epochs[cohort],
            expires_at=utc_now() + timedelta(seconds=ttl_seconds),
        )
        self._lock_holders[cohort] = token
        return token

    def validate(self, token: LeaseToken, now: datetime | None = None) -> bool:
        now = now or utc_now()
        current = self._lock_holders.get(token.cohort)
        if current is None:
            return False
        return (
            token.epoch == current.epoch
            and token.owner_region == current.owner_region
            and token.expires_at >= now
        )


# --- Assignment Store ---


class AssignmentStore:
    def __init__(self, token_manager: FencingTokenManager) -> None:
        self.token_manager = token_manager
        self.assignments: dict[str, TenantAssignment] = {}

    def write_assignment(
        self, assignment: TenantAssignment, token: LeaseToken
    ) -> bool:
        if not self.token_manager.validate(token):
            return False
        self.assignments[assignment.tenant_id] = assignment
        return True

    def for_cohort(self, cohort: str) -> list[TenantAssignment]:
        return [a for a in self.assignments.values() if a.cohort == cohort]

    def read_assignments_fenced(
        self, cohort: str, token: LeaseToken
    ) -> list[TenantAssignment] | None:
        """Read-path fence: verify token authorizes reads for this cohort."""
        if not self.token_manager.validate(token):
            return None
        if token.cohort != cohort:
            return None
        return self.for_cohort(cohort)


# --- Policy Rollout ---


class SnapshotAckTracker:
    def __init__(self) -> None:
        self.acks: defaultdict[str, dict[str, dict[AckPhase, int]]] = defaultdict(
            lambda: defaultdict(dict)
        )

    def record_ack(
        self, snapshot_id: str, region: str, phase: AckPhase, version: int
    ) -> None:
        current = self.acks[snapshot_id].get(region, {}).get(phase, 0)
        self.acks[snapshot_id][region][phase] = max(version, current)

    def has_quorum(
        self,
        snapshot_id: str,
        view: MembershipView,
        phase: AckPhase,
        target_version: int,
    ) -> bool:
        regions_at_phase = set()
        for region in view.regions:
            region_acks = self.acks.get(snapshot_id, {}).get(region, {})
            if region_acks.get(phase, 0) >= target_version:
                regions_at_phase.add(region)
        return QuorumMath.reached(view, regions_at_phase)


class PolicyStore:
    def __init__(self) -> None:
        self.committed: dict[str, PolicySnapshot] = {}
        self.active_serving: dict[str, PolicySnapshot] = {}

    def mark_committed(self, snapshot: PolicySnapshot) -> None:
        self.committed[snapshot.cohort] = snapshot

    def mark_serving(self, snapshot: PolicySnapshot) -> None:
        self.active_serving[snapshot.cohort] = snapshot


class PolicyEventBus:
    def __init__(self) -> None:
        self.handlers: list[object] = []
        self.events: list[dict[str, object]] = []

    def publish(self, event: dict[str, object]) -> None:
        self.events.append(event)
        for handler in self.handlers:
            if hasattr(handler, "on_event"):
                handler.on_event(event)


class PolicyRollout:
    def __init__(
        self,
        acks: SnapshotAckTracker,
        policy_store: PolicyStore,
        bus: PolicyEventBus,
        membership: MembershipJournal,
    ) -> None:
        self.acks = acks
        self.policy_store = policy_store
        self.bus = bus
        self.membership = membership

    def commit_if_durable(self, snapshot: PolicySnapshot) -> bool:
        view = self.membership.current_view(snapshot.cohort)
        if view is None:
            return False
        if self.acks.has_quorum(
            snapshot.snapshot_id, view, AckPhase.DURABLE, snapshot.version
        ):
            self.policy_store.mark_committed(snapshot)
            self.bus.publish(
                {
                    "type": "policy_committed",
                    "snapshot_id": snapshot.snapshot_id,
                    "cohort": snapshot.cohort,
                    "version": snapshot.version,
                }
            )
            return True
        return False

    def promote_to_serving(self, snapshot: PolicySnapshot) -> bool:
        view = self.membership.current_view(snapshot.cohort)
        if view is None:
            return False
        if self.acks.has_quorum(
            snapshot.snapshot_id, view, AckPhase.SERVING, snapshot.version
        ):
            self.policy_store.mark_serving(snapshot)
            return True
        return False


class TrafficDirector:
    def __init__(self, metrics: MetricsSink | None = None) -> None:
        self.metrics = metrics or MetricsSink()
        self.active_policy: dict[str, str] = {}
        self.weights: defaultdict[str, dict[str, int]] = defaultdict(dict)

    def on_event(self, event: dict[str, object]) -> None:
        if event.get("type") == "policy_committed":
            self.active_policy[str(event["cohort"])] = str(event["snapshot_id"])
            self.metrics.increment("policy.activated")

    def shift(self, cohort: str, target_region: str) -> None:
        self.weights[cohort] = {target_region: 100}
        self.metrics.increment("traffic.shifted")

    def set_weights(self, cohort: str, weights: dict[str, int]) -> None:
        self.weights[cohort] = dict(weights)


# --- Operation Journal and Idempotency ---


class OperationJournal:
    def __init__(self) -> None:
        self._results: dict[tuple[str, str, str], CommandResult] = {}

    def idempotency_key(self, env: CommandEnvelope) -> tuple[str, str, str]:
        return (env.operation_id, env.cohort, env.intent.public_effect)

    def lookup(self, env: CommandEnvelope) -> CommandResult | None:
        return self._results.get(self.idempotency_key(env))

    def record(self, env: CommandEnvelope, result: CommandResult) -> None:
        self._results[self.idempotency_key(env)] = result

    def execute(
        self, env: CommandEnvelope, handler: object
    ) -> CommandResult:
        existing = self.lookup(env)
        if existing is not None:
            return existing
        result = handler.handle(env)
        self.record(env, result)
        return result


# --- Drain and Freeze ---


class DrainLedger:
    def __init__(self) -> None:
        self.requested: dict[str, int] = {}
        self.confirmed: dict[str, int] = {}
        self._watermarks: dict[tuple[str, str], WatermarkVector] = {}

    def request_drain(self, cohort: str, epoch: int) -> None:
        self.requested[cohort] = epoch

    def confirm_drain(self, cohort: str, epoch: int) -> None:
        if cohort in self.requested:
            self.confirmed[cohort] = epoch

    def is_drained(self, cohort: str) -> bool:
        return cohort in self.confirmed

    def record_watermark(
        self, cohort: str, stream: str, position: int
    ) -> None:
        key = (cohort, stream)
        if key not in self._watermarks:
            self._watermarks[key] = WatermarkVector(positions={})
        current = dict(self._watermarks[key].positions)
        current[stream] = max(current.get(stream, 0), position)
        self._watermarks[key] = WatermarkVector(positions=current)

    def required_watermarks(
        self, cohort: str, streams: set[str]
    ) -> WatermarkVector:
        positions: dict[str, int] = {}
        for stream in streams:
            key = (cohort, stream)
            wm = self._watermarks.get(key)
            if wm:
                positions.update(wm.positions)
        return WatermarkVector(positions=positions)


# --- Ownership and Recovery ---


class OwnershipRegistry:
    def __init__(self) -> None:
        self._streams: defaultdict[str, set[str]] = defaultdict(set)
        self._history: list[tuple[str, set[str], datetime]] = []

    def assign_streams(self, cohort: str, streams: set[str]) -> None:
        self._history.append((cohort, set(self._streams[cohort]), utc_now()))
        self._streams[cohort] = streams

    def current_streams_for(self, cohort: str) -> set[str]:
        return self._streams.get(cohort, set())

    def streams_at_epoch(self, cohort: str, epoch: int) -> set[str] | None:
        if epoch < len(self._history):
            entry_cohort, streams, _ = self._history[epoch]
            if entry_cohort == cohort:
                return streams
        return None


class ReplayTracker:
    def __init__(self) -> None:
        self._positions: defaultdict[str, WatermarkVector] = defaultdict(
            lambda: WatermarkVector(positions={})
        )

    def update(self, region: str, stream: str, position: int) -> None:
        current = dict(self._positions[region].positions)
        current[stream] = max(current.get(stream, 0), position)
        self._positions[region] = WatermarkVector(positions=current)

    def watermark_for(self, region: str) -> WatermarkVector:
        return self._positions[region]


class RecoveryGate:
    def __init__(
        self,
        ownership: OwnershipRegistry,
        drain: DrainLedger,
        replay: ReplayTracker,
    ) -> None:
        self.ownership = ownership
        self.drain = drain
        self.replay = replay

    def can_admit(self, cohort: str, recovered_region: str) -> bool:
        streams = self.ownership.current_streams_for(cohort)
        required = self.drain.required_watermarks(cohort, streams)
        return self.replay.watermark_for(recovered_region).dominates(required)


# --- Capacity Planning ---


class SharedPoolLedger:
    def __init__(self) -> None:
        self._holds: defaultdict[str, int] = defaultdict(int)

    def hold(self, region: str, units: int, plan_id: str) -> bool:
        self._holds[region] += units
        return True

    def release(self, region: str, units: int, plan_id: str) -> None:
        self._holds[region] = max(0, self._holds[region] - units)

    def current_held(self, region: str) -> int:
        return self._holds[region]


class FamilyLedger:
    def __init__(self) -> None:
        self._reservations: defaultdict[tuple[str, str], int] = defaultdict(int)

    def reserve(self, region: str, family: str, plan_id: str, units: int) -> None:
        self._reservations[(region, family)] += units

    def reserved(self, region: str, family: str) -> int:
        return self._reservations[(region, family)]


class CapacityIndex:
    def __init__(self) -> None:
        self._capacities: dict[str, RegionCapacity] = {}

    def register(self, capacity: RegionCapacity) -> None:
        self._capacities[capacity.region] = capacity

    def snapshot(self, region: str) -> RegionCapacity | None:
        return self._capacities.get(region)

    def can_fit(
        self, capacity: RegionCapacity, by_family: dict[str, int], spillover: int
    ) -> bool:
        family_ok = all(
            capacity.families.get(fam, 0) >= units
            for fam, units in by_family.items()
        )
        spillover_ok = capacity.spare_units >= spillover
        return family_ok and spillover_ok


class CapacityPlanner:
    def __init__(
        self,
        index: CapacityIndex,
        shared_pool: SharedPoolLedger,
        family_ledgers: FamilyLedger,
        safety_factor: float = 0.85,
    ) -> None:
        self.index = index
        self.shared_pool = shared_pool
        self.family_ledgers = family_ledgers
        self.safety_factor = safety_factor

    def reserve(self, plan: CapacityPlan) -> bool:
        snap = self.index.snapshot(plan.target_region)
        if snap is None:
            return False
        if not self.index.can_fit(snap, plan.by_family, plan.shared_spillover):
            return False
        for family, units in plan.by_family.items():
            self.family_ledgers.reserve(
                plan.target_region, family, plan.plan_id, units
            )
        return True

    def reserve_with_shared_hold(self, plan: CapacityPlan) -> bool:
        """Correct serialization: hold shared pool first, then per-family."""
        self.shared_pool.hold(
            plan.target_region, plan.shared_spillover, plan.plan_id
        )
        snap = self.index.snapshot(plan.target_region)
        if snap is None:
            self.shared_pool.release(
                plan.target_region, plan.shared_spillover, plan.plan_id
            )
            return False
        if not self.index.can_fit(snap, plan.by_family, plan.shared_spillover):
            self.shared_pool.release(
                plan.target_region, plan.shared_spillover, plan.plan_id
            )
            return False
        for family, units in plan.by_family.items():
            self.family_ledgers.reserve(
                plan.target_region, family, plan.plan_id, units
            )
        return True


# --- Failure Detection ---


class FailureDetector:
    def __init__(
        self,
        membership: MembershipJournal,
        quorum: type[QuorumMath] = QuorumMath,
    ) -> None:
        self.membership = membership
        self.quorum = quorum
        self._certificates: dict[str, AbandonmentCertificate] = {}

    def abandonment_certificate(
        self,
        cohort: str,
        source_region: str,
        witnesses: list[Witness],
        current_epoch: int,
    ) -> AbandonmentCertificate | None:
        view = self.membership.current_view(cohort)
        if view is None:
            return None
        qualifying = [
            w
            for w in witnesses
            if w.control_plane_rtt_ms is None
            and w.edge_healthy
            and w.epoch == current_epoch
        ]
        ack_regions = {w.region for w in qualifying}
        if self.quorum.reached(view, ack_regions):
            cert = AbandonmentCertificate(
                source=source_region,
                epoch=current_epoch,
                witnesses=frozenset(ack_regions),
                issued_at=utc_now(),
            )
            self._certificates[source_region] = cert
            return cert
        return None

    def has_certificate(self, region: str) -> bool:
        return region in self._certificates


# --- Failover Runbook ---


class FailoverRunbook:
    def __init__(
        self,
        token_manager: FencingTokenManager,
        assignments: AssignmentStore,
        drain: DrainLedger,
        router: TrafficDirector,
        journal: OperationJournal,
        ownership: OwnershipRegistry,
        recovery_gate: RecoveryGate | None = None,
    ) -> None:
        self.token_manager = token_manager
        self.assignments = assignments
        self.drain = drain
        self.router = router
        self.journal = journal
        self.ownership = ownership
        self.recovery_gate = recovery_gate

    def handle(self, env: CommandEnvelope) -> CommandResult:
        if env.intent.action == "failover_start":
            return self._do_failover(env)
        if env.intent.action == "recovery_admit":
            return self._do_recovery_admit(env, self.recovery_gate)
        return CommandResult(
            operation_id=env.operation_id,
            cohort=env.cohort,
            outcome="unknown_action",
        )

    def _do_failover(self, env: CommandEnvelope) -> CommandResult:
        target = env.intent.target_region
        token = self.token_manager.issue(env.cohort, target)
        self.drain.request_drain(env.cohort, token.epoch)
        self._await_drain(env.cohort)
        self.router.shift(env.cohort, target)
        for assignment in self.assignments.for_cohort(env.cohort):
            self.assignments.write_assignment(
                TenantAssignment(
                    tenant_id=assignment.tenant_id,
                    cohort=env.cohort,
                    region=target,
                    assignment_epoch=token.epoch,
                    updated_at=utc_now(),
                ),
                token=token,
            )
        return CommandResult(
            operation_id=env.operation_id,
            cohort=env.cohort,
            outcome="failover_complete",
            details={"target": target, "epoch": token.epoch},
        )

    def _await_drain(self, cohort: str) -> None:
        """Block until drain is confirmed by external acknowledgement."""
        while not self.drain.is_drained(cohort):
            break

    def _do_recovery_admit(
        self, env: CommandEnvelope, recovery_gate: RecoveryGate | None = None
    ) -> CommandResult:
        target = env.intent.target_region
        if recovery_gate and not recovery_gate.can_admit(env.cohort, target):
            return CommandResult(
                operation_id=env.operation_id,
                cohort=env.cohort,
                outcome="recovery_blocked",
                details={"region": target, "reason": "watermark_not_met"},
            )
        self.router.set_weights(env.cohort, {target: 25})
        return CommandResult(
            operation_id=env.operation_id,
            cohort=env.cohort,
            outcome="recovery_admitted",
            details={"region": target},
        )


# --- Incident Timeline ---


class IncidentTimeline:
    def __init__(self) -> None:
        self.events: list[dict[str, object]] = []

    def add(
        self,
        region: str,
        event: str,
        epoch: int,
        sequence: int,
        wall_clock: datetime,
        details: dict[str, object] | None = None,
    ) -> None:
        self.events.append(
            {
                "region": region,
                "event": event,
                "epoch": epoch,
                "sequence": sequence,
                "wall_clock": wall_clock,
                "details": details or {},
            }
        )
        self.events.sort(key=lambda e: (e["epoch"], e["wall_clock"]))

    def describe(self) -> list[str]:
        return [
            f"[{e['epoch']}:{e['sequence']}] {e['wall_clock'].isoformat()} "
            f"{e['region']} {e['event']}"
            for e in self.events
        ]


# --- Health Probe ---


class HealthProbeAggregator:
    def __init__(
        self, failure_threshold: int = 3, window_seconds: int = 120
    ) -> None:
        self.failure_threshold = failure_threshold
        self.window_seconds = window_seconds

    def aggregate(
        self, samples: Iterable[Witness], now: datetime | None = None
    ) -> dict[str, RegionState]:
        now = now or utc_now()
        cutoff = now - timedelta(seconds=self.window_seconds)
        by_region: defaultdict[str, list[Witness]] = defaultdict(list)
        for sample in samples:
            if sample.sampled_at >= cutoff:
                by_region[sample.region].append(sample)
        states: dict[str, RegionState] = {}
        for region, items in by_region.items():
            unreachable = sum(
                1 for w in items if w.control_plane_rtt_ms is None
            )
            if unreachable >= self.failure_threshold:
                states[region] = RegionState.DEGRADED
            else:
                states[region] = RegionState.ACTIVE
        return states


# --- Control Plane Facade ---


class ControlPlane:
    def __init__(self) -> None:
        self.metrics = MetricsSink()
        self.membership = MembershipJournal()
        self.tokens = FencingTokenManager()
        self.assignments = AssignmentStore(self.tokens)
        self.drain = DrainLedger()
        self.ownership = OwnershipRegistry()
        self.replay = ReplayTracker()
        self.recovery_gate = RecoveryGate(
            self.ownership, self.drain, self.replay
        )
        self.bus = PolicyEventBus()
        self.acks = SnapshotAckTracker()
        self.policy_store = PolicyStore()
        self.router = TrafficDirector(self.metrics)
        self.bus.handlers.append(self.router)
        self.policy_rollout = PolicyRollout(
            self.acks, self.policy_store, self.bus, self.membership
        )
        self.journal = OperationJournal()
        self.runbook = FailoverRunbook(
            self.tokens,
            self.assignments,
            self.drain,
            self.router,
            self.journal,
            self.ownership,
            self.recovery_gate,
        )
        self.capacity_index = CapacityIndex()
        self.shared_pool = SharedPoolLedger()
        self.family_ledgers = FamilyLedger()
        self.planner = CapacityPlanner(
            self.capacity_index,
            self.shared_pool,
            self.family_ledgers,
        )
        self.detector = FailureDetector(self.membership)
        self.timeline = IncidentTimeline()

    def seed_membership(self, cohort: str, regions: set[str]) -> None:
        view = MembershipView(
            view_id=f"{cohort}-initial",
            epoch=0,
            regions=frozenset(regions),
            created_at=utc_now(),
        )
        self.membership.views[cohort] = view

    def seed_assignment(
        self, tenant_id: str, cohort: str, region: str
    ) -> None:
        token = self.tokens.issue(cohort, region)
        self.assignments.write_assignment(
            TenantAssignment(
                tenant_id=tenant_id,
                cohort=cohort,
                region=region,
                assignment_epoch=token.epoch,
                updated_at=utc_now(),
            ),
            token=token,
        )

    def execute_command(self, env: CommandEnvelope) -> CommandResult:
        return self.journal.execute(env, self.runbook)
