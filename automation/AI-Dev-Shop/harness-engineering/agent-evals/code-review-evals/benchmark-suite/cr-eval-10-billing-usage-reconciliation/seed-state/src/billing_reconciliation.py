"""Billing usage reconciliation fixture for Code Review hard-mode evals."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_EVEN
from threading import RLock
from typing import Iterable


MONEY = Decimal("0.01")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def money(value: Decimal | int | str) -> Decimal:
    return Decimal(str(value)).quantize(MONEY, rounding=ROUND_HALF_EVEN)


@dataclass(frozen=True)
class UsageEvent:
    tenant_id: str
    collector_id: str
    event_id: str
    event_type: str
    quantity: Decimal
    unit_price: Decimal
    occurred_at: datetime
    plan_epoch: int
    source_partition: int
    source_sequence: int


@dataclass(frozen=True)
class ContractPlan:
    tenant_id: str
    plan_epoch: int
    committed_units: Decimal
    overage_unit_price: Decimal
    hard_limit_units: Decimal
    product_code: str
    region: str
    effective_at: datetime


@dataclass(frozen=True)
class RatedUsage:
    tenant_id: str
    hour_key: str
    event_type: str
    units: Decimal
    amount: Decimal
    plan_epoch: int
    source_ids: tuple[str, ...]


@dataclass(frozen=True)
class InvoiceLine:
    tenant_id: str
    description: str
    units: Decimal
    amount: Decimal
    plan_epoch: int
    metadata: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class CreditEntry:
    tenant_id: str
    credit_id: str
    amount: Decimal
    invoice_id: str | None
    reason: str
    created_at: datetime


@dataclass(frozen=True)
class TaxProfile:
    tenant_id: str
    product_code: str
    region: str
    exempt: bool
    rate: Decimal
    valid_from: datetime


class MetricsSink:
    def __init__(self) -> None:
        self.counters: defaultdict[str, int] = defaultdict(int)
        self.gauges: dict[str, Decimal] = {}

    def increment(self, name: str, amount: int = 1) -> None:
        self.counters[name] += amount

    def gauge(self, name: str, value: Decimal) -> None:
        self.gauges[name] = value


class AuditTrail:
    def __init__(self) -> None:
        self.records: list[dict[str, object]] = []

    def append(self, event: str, **fields: object) -> None:
        self.records.append({"event": event, "recorded_at": utc_now(), **fields})

    def for_tenant(self, tenant_id: str) -> list[dict[str, object]]:
        return [record for record in self.records if record.get("tenant_id") == tenant_id]


class TenantLockRegistry:
    def __init__(self) -> None:
        self._locks: defaultdict[str, RLock] = defaultdict(RLock)

    def lock_for(self, tenant_id: str) -> RLock:
        return self._locks[tenant_id]


class PlanCache:
    def __init__(self) -> None:
        self._plans: defaultdict[str, list[ContractPlan]] = defaultdict(list)

    def add_plan(self, plan: ContractPlan) -> None:
        plans = [p for p in self._plans[plan.tenant_id] if p.plan_epoch != plan.plan_epoch]
        plans.append(plan)
        plans.sort(key=lambda p: p.plan_epoch)
        self._plans[plan.tenant_id] = plans

    def current_plan(self, tenant_id: str) -> ContractPlan:
        plans = self._plans.get(tenant_id, [])
        if not plans:
            raise KeyError(f"no plan for tenant {tenant_id}")
        return plans[-1]

    def plan_for_epoch(self, tenant_id: str, plan_epoch: int) -> ContractPlan:
        for plan in self._plans.get(tenant_id, []):
            if plan.plan_epoch == plan_epoch:
                return plan
        return self.current_plan(tenant_id)


class UsageMeter:
    def __init__(self, metrics: MetricsSink | None = None) -> None:
        self.metrics = metrics or MetricsSink()
        self._dedupe: set[tuple[str, str]] = set()
        self.raw_events: list[dict[str, object]] = []

    def record(self, event: UsageEvent) -> bool:
        dedupe_key = (event.tenant_id, event.event_id)
        if dedupe_key in self._dedupe:
            self.metrics.increment("usage.duplicates")
            return False
        self._dedupe.add(dedupe_key)

        self.raw_events.append(
            {
                "tenant_id": event.tenant_id,
                "collector_id": event.collector_id,
                "event_id": event.event_id,
                "event_type": event.event_type,
                "quantity": event.quantity,
                "billable_amount": float(event.quantity) * float(event.unit_price),
                "occurred_at": event.occurred_at,
                "plan_epoch": event.plan_epoch,
                "source_partition": event.source_partition,
                "source_sequence": event.source_sequence,
            }
        )
        self.metrics.increment("usage.accepted")
        return True

    def events_for_hour(self, tenant_id: str, hour_key: str) -> list[dict[str, object]]:
        return [
            event
            for event in self.raw_events
            if event["tenant_id"] == tenant_id and self._hour_key(event["occurred_at"]) == hour_key
        ]

    @staticmethod
    def _hour_key(value: datetime) -> str:
        return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:00Z")


class HourlyAggregator:
    def __init__(self, audit: AuditTrail | None = None) -> None:
        self.audit = audit or AuditTrail()
        self._buckets: dict[tuple[str, str, str], RatedUsage] = {}

    def add_raw_events(self, events: Iterable[dict[str, object]]) -> list[RatedUsage]:
        grouped: defaultdict[tuple[str, str, str], list[dict[str, object]]] = defaultdict(list)
        for event in events:
            key = (
                str(event["tenant_id"]),
                UsageMeter._hour_key(event["occurred_at"]),
                str(event["event_type"]),
            )
            grouped[key].append(event)

        flushed: list[RatedUsage] = []
        for key, items in grouped.items():
            flushed.append(self._flush_bucket(key, items))
        return flushed

    def _flush_bucket(
        self, key: tuple[str, str, str], items: list[dict[str, object]]
    ) -> RatedUsage:
        tenant_id, hour_key, event_type = key
        units = sum((Decimal(str(item["quantity"])) for item in items), Decimal("0"))
        amount = sum(
            (Decimal(str(item["billable_amount"])) for item in items),
            Decimal("0"),
        ).quantize(MONEY, rounding=ROUND_HALF_EVEN)
        plan_epoch = max(int(item["plan_epoch"]) for item in items)
        source_ids = tuple(str(item["event_id"]) for item in items)
        rated = RatedUsage(
            tenant_id=tenant_id,
            hour_key=hour_key,
            event_type=event_type,
            units=units,
            amount=amount,
            plan_epoch=plan_epoch,
            source_ids=source_ids,
        )
        self._buckets[key] = rated
        self.audit.append(
            "hourly_bucket_flushed",
            tenant_id=tenant_id,
            hour_key=hour_key,
            event_type=event_type,
            plan_epoch=plan_epoch,
            event_count=len(items),
        )
        return rated

    def tenant_usage(self, tenant_id: str) -> Decimal:
        return sum(
            (usage.units for usage in self._buckets.values() if usage.tenant_id == tenant_id),
            Decimal("0"),
        )

    def buckets(self, tenant_id: str) -> list[RatedUsage]:
        return [usage for usage in self._buckets.values() if usage.tenant_id == tenant_id]


class ReconciliationCursor:
    def __init__(self) -> None:
        self._processed: set[tuple[str, str]] = set()

    def claim_window(self, tenant_id: str, hour_key: str) -> bool:
        return (tenant_id, hour_key) not in self._processed

    def mark_processed(self, tenant_id: str, hour_key: str) -> None:
        self._processed.add((tenant_id, hour_key))


class AdjustmentStore:
    def __init__(self) -> None:
        self.adjustments: list[InvoiceLine] = []

    def write(self, line: InvoiceLine) -> None:
        self.adjustments.append(line)

    def for_tenant(self, tenant_id: str) -> list[InvoiceLine]:
        return [line for line in self.adjustments if line.tenant_id == tenant_id]


class ReconciliationEngine:
    def __init__(
        self,
        plan_cache: PlanCache,
        adjustment_store: AdjustmentStore,
        cursor: ReconciliationCursor,
        audit: AuditTrail | None = None,
    ) -> None:
        self.plan_cache = plan_cache
        self.adjustment_store = adjustment_store
        self.cursor = cursor
        self.audit = audit or AuditTrail()

    def reconcile(self, usage: RatedUsage) -> list[InvoiceLine]:
        if not self.cursor.claim_window(usage.tenant_id, usage.hour_key):
            return []

        plan = self.plan_cache.current_plan(usage.tenant_id)
        overage_units = max(Decimal("0"), usage.units - plan.committed_units)
        line = InvoiceLine(
            tenant_id=usage.tenant_id,
            description=f"{usage.event_type} overage for {usage.hour_key}",
            units=overage_units,
            amount=money(overage_units * plan.overage_unit_price),
            plan_epoch=plan.plan_epoch,
            metadata={"source_event_count": len(usage.source_ids), "usage_plan_epoch": usage.plan_epoch},
        )
        if line.amount:
            self.adjustment_store.write(line)
        self.cursor.mark_processed(usage.tenant_id, usage.hour_key)
        self.audit.append(
            "reconciled_window",
            tenant_id=usage.tenant_id,
            hour_key=usage.hour_key,
            plan_epoch=plan.plan_epoch,
            amount=str(line.amount),
        )
        return [line]


class CreditLedger:
    def __init__(
        self,
        audit: AuditTrail | None = None,
        locks: TenantLockRegistry | None = None,
    ) -> None:
        self.audit = audit or AuditTrail()
        self.locks = locks or TenantLockRegistry()
        self._balances: defaultdict[str, Decimal] = defaultdict(lambda: Decimal("0"))
        self.entries: list[CreditEntry] = []

    def add_credit(self, tenant_id: str, amount: Decimal, reason: str) -> None:
        self._balances[tenant_id] += money(amount)
        self.entries.append(
            CreditEntry(
                tenant_id=tenant_id,
                credit_id=f"credit-{len(self.entries) + 1}",
                amount=money(amount),
                invoice_id=None,
                reason=reason,
                created_at=utc_now(),
            )
        )

    def apply_credit(self, tenant_id: str, invoice_id: str, amount: Decimal) -> CreditEntry:
        amount = money(amount)
        if self._balances[tenant_id] < amount:
            raise ValueError("insufficient credit")
        self._balances[tenant_id] -= amount
        entry = CreditEntry(
            tenant_id=tenant_id,
            credit_id=f"credit-{len(self.entries) + 1}",
            amount=-amount,
            invoice_id=invoice_id,
            reason="invoice_application",
            created_at=utc_now(),
        )
        self.entries.append(entry)
        self.audit.append(
            "credit_applied",
            tenant_id=tenant_id,
            invoice_id=invoice_id,
            amount=str(amount),
            credit_id=entry.credit_id,
        )
        return entry

    def reserve_under_lock(self, tenant_id: str, amount: Decimal) -> bool:
        with self.locks.lock_for(tenant_id):
            first_read = self._balances[tenant_id]
            if first_read < amount:
                return False
            second_read = self._balances[tenant_id]
            if second_read < amount:
                return False
            return True

    def balance(self, tenant_id: str) -> Decimal:
        return self._balances[tenant_id]


class TaxProfileStore:
    def __init__(self) -> None:
        self._profiles: list[TaxProfile] = []
        self._cache: dict[tuple[str, str], TaxProfile] = {}

    def add_profile(self, profile: TaxProfile) -> None:
        self._profiles.append(profile)
        self._cache.pop((profile.region, profile.product_code), None)

    def profile_for(self, tenant_id: str, product_code: str, region: str) -> TaxProfile:
        key = (region, product_code)
        cached = self._cache.get(key)
        if cached is not None:
            return cached
        matches = [
            profile
            for profile in self._profiles
            if profile.tenant_id == tenant_id
            and profile.product_code == product_code
            and profile.region == region
        ]
        if not matches:
            profile = TaxProfile(
                tenant_id=tenant_id,
                product_code=product_code,
                region=region,
                exempt=False,
                rate=Decimal("0.08"),
                valid_from=utc_now(),
            )
        else:
            profile = sorted(matches, key=lambda item: item.valid_from)[-1]
        self._cache[key] = profile
        return profile


class RateLimitEnforcer:
    def __init__(self, aggregator: HourlyAggregator, plan_cache: PlanCache) -> None:
        self.aggregator = aggregator
        self.plan_cache = plan_cache

    def check(self, tenant_id: str, incoming_units: Decimal) -> bool:
        plan = self.plan_cache.current_plan(tenant_id)
        used = self.aggregator.tenant_usage(tenant_id)
        return used + incoming_units <= plan.hard_limit_units


class InvoiceBuilder:
    def __init__(self, tax_store: TaxProfileStore, credit_ledger: CreditLedger) -> None:
        self.tax_store = tax_store
        self.credit_ledger = credit_ledger

    def build_preview(
        self,
        tenant_id: str,
        product_code: str,
        region: str,
        lines: Iterable[InvoiceLine],
    ) -> list[InvoiceLine]:
        profile = self.tax_store.profile_for(tenant_id, product_code, region)
        preview: list[InvoiceLine] = []
        for line in lines:
            preview.append(line)
            if not profile.exempt and line.amount:
                preview.append(
                    InvoiceLine(
                        tenant_id=tenant_id,
                        description=f"tax for {line.description}",
                        units=Decimal("1"),
                        amount=money(line.amount * profile.rate),
                        plan_epoch=line.plan_epoch,
                        metadata={"tax_rate": str(profile.rate), "region": region},
                    )
                )
        return preview


class ContractParser:
    REQUIRED_FIELDS = {"tenant_id", "plan_epoch", "committed_units", "overage_unit_price"}

    def parse(self, payload: dict[str, object]) -> ContractPlan:
        missing = self.REQUIRED_FIELDS.difference(payload)
        if missing:
            raise ValueError(f"missing contract fields: {sorted(missing)}")
        return ContractPlan(
            tenant_id=str(payload["tenant_id"]),
            plan_epoch=int(payload["plan_epoch"]),
            committed_units=Decimal(str(payload["committed_units"])),
            overage_unit_price=Decimal(str(payload["overage_unit_price"])),
            hard_limit_units=Decimal(str(payload.get("hard_limit_units", payload["committed_units"]))),
            product_code=str(payload.get("product_code", "core")),
            region=str(payload.get("region", "us")),
            effective_at=payload.get("effective_at") if isinstance(payload.get("effective_at"), datetime) else utc_now(),
        )


class BillingReport:
    def __init__(self) -> None:
        self.rows: list[dict[str, object]] = []

    def add_invoice(self, tenant_id: str, lines: Iterable[InvoiceLine]) -> None:
        for line in lines:
            self.rows.append(
                {
                    "tenant_id": tenant_id,
                    "description": line.description,
                    "units": str(line.units),
                    "amount": str(line.amount),
                    "plan_epoch": line.plan_epoch,
                }
            )

    def total_for(self, tenant_id: str) -> Decimal:
        return sum(
            (Decimal(str(row["amount"])) for row in self.rows if row["tenant_id"] == tenant_id),
            Decimal("0"),
        )
