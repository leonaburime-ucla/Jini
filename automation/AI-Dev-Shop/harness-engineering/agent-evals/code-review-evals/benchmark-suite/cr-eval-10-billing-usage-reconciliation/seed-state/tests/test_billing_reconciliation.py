from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from src.billing_reconciliation import (
    BillingReport,
    ContractParser,
    ContractPlan,
    CreditLedger,
    HourlyAggregator,
    InvoiceBuilder,
    PlanCache,
    RateLimitEnforcer,
    ReconciliationCursor,
    ReconciliationEngine,
    TaxProfile,
    TaxProfileStore,
    UsageEvent,
    UsageMeter,
    AdjustmentStore,
)


NOW = datetime(2026, 5, 1, 12, 15, tzinfo=timezone.utc)


def make_event(
    tenant_id: str = "tenant-a",
    event_id: str = "evt-1",
    *,
    quantity: str = "10",
    unit_price: str = "0.25",
    plan_epoch: int = 1,
) -> UsageEvent:
    return UsageEvent(
        tenant_id=tenant_id,
        collector_id="collector-a",
        event_id=event_id,
        event_type="api_call",
        quantity=Decimal(quantity),
        unit_price=Decimal(unit_price),
        occurred_at=NOW,
        plan_epoch=plan_epoch,
        source_partition=1,
        source_sequence=10,
    )


def make_plan(tenant_id: str = "tenant-a", epoch: int = 1) -> ContractPlan:
    return ContractPlan(
        tenant_id=tenant_id,
        plan_epoch=epoch,
        committed_units=Decimal("5"),
        overage_unit_price=Decimal("0.25"),
        hard_limit_units=Decimal("100"),
        product_code="core",
        region="us",
        effective_at=NOW,
    )


def test_usage_meter_accepts_and_dedupes_same_event() -> None:
    meter = UsageMeter()
    event = make_event()

    assert meter.record(event)
    assert not meter.record(event)
    assert len(meter.raw_events) == 1


def test_hourly_aggregator_flushes_bucket_with_decimal_total() -> None:
    meter = UsageMeter()
    meter.record(make_event("tenant-a", "evt-1", quantity="2", unit_price="0.10"))
    meter.record(make_event("tenant-a", "evt-2", quantity="3", unit_price="0.10"))

    aggregator = HourlyAggregator()
    buckets = aggregator.add_raw_events(meter.raw_events)

    assert len(buckets) == 1
    assert buckets[0].units == Decimal("5")
    assert buckets[0].amount == Decimal("0.50")


def test_reconciliation_writes_overage_adjustment() -> None:
    cache = PlanCache()
    cache.add_plan(make_plan())
    store = AdjustmentStore()
    engine = ReconciliationEngine(cache, store, ReconciliationCursor())
    aggregator = HourlyAggregator()
    usage = aggregator.add_raw_events(
        [
            {
                "tenant_id": "tenant-a",
                "event_type": "api_call",
                "quantity": Decimal("10"),
                "billable_amount": 2.50,
                "occurred_at": NOW,
                "plan_epoch": 1,
                "event_id": "evt-1",
            }
        ]
    )[0]

    lines = engine.reconcile(usage)

    assert lines[0].units == Decimal("5")
    assert lines[0].amount == Decimal("1.25")
    assert store.for_tenant("tenant-a")[0].description.startswith("api_call")


def test_credit_ledger_applies_credit_and_records_entry() -> None:
    ledger = CreditLedger()
    ledger.add_credit("tenant-a", Decimal("20.00"), "prepaid")

    entry = ledger.apply_credit("tenant-a", "inv-1", Decimal("7.50"))

    assert entry.amount == Decimal("-7.50")
    assert ledger.balance("tenant-a") == Decimal("12.50")


def test_credit_reserve_double_read_is_guarded_by_tenant_lock() -> None:
    ledger = CreditLedger()
    ledger.add_credit("tenant-a", Decimal("5.00"), "goodwill")

    assert ledger.reserve_under_lock("tenant-a", Decimal("4.00"))
    assert not ledger.reserve_under_lock("tenant-a", Decimal("6.00"))


def test_invoice_builder_applies_tax_for_non_exempt_profile() -> None:
    tax_store = TaxProfileStore()
    tax_store.add_profile(
        TaxProfile(
            tenant_id="tenant-a",
            product_code="core",
            region="us",
            exempt=False,
            rate=Decimal("0.10"),
            valid_from=NOW,
        )
    )
    builder = InvoiceBuilder(tax_store, CreditLedger())

    preview = builder.build_preview(
        "tenant-a",
        "core",
        "us",
        [
            __import__("src.billing_reconciliation", fromlist=["InvoiceLine"]).InvoiceLine(
                tenant_id="tenant-a",
                description="usage",
                units=Decimal("1"),
                amount=Decimal("10.00"),
                plan_epoch=1,
            )
        ],
    )

    assert [line.amount for line in preview] == [Decimal("10.00"), Decimal("1.00")]


def test_rate_limit_allows_within_current_bucket_total() -> None:
    cache = PlanCache()
    cache.add_plan(make_plan())
    aggregator = HourlyAggregator()
    enforcer = RateLimitEnforcer(aggregator, cache)

    assert enforcer.check("tenant-a", Decimal("10"))


def test_contract_parser_validates_required_fields() -> None:
    parser = ContractParser()
    plan = parser.parse(
        {
            "tenant_id": "tenant-a",
            "plan_epoch": 4,
            "committed_units": "100",
            "overage_unit_price": "0.05",
            "hard_limit_units": "200",
        }
    )

    assert plan.plan_epoch == 4
    assert plan.hard_limit_units == Decimal("200")


def test_billing_report_totals_invoice_lines() -> None:
    report = BillingReport()
    report.add_invoice(
        "tenant-a",
        [
            __import__("src.billing_reconciliation", fromlist=["InvoiceLine"]).InvoiceLine(
                tenant_id="tenant-a",
                description="usage",
                units=Decimal("1"),
                amount=Decimal("3.25"),
                plan_epoch=1,
            )
        ],
    )

    assert report.total_for("tenant-a") == Decimal("3.25")
