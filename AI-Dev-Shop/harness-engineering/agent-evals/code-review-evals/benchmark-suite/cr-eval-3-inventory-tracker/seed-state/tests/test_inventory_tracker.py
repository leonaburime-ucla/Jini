"""Tests for inventory reservation, transfer, and reconciliation service."""
from __future__ import annotations

import pytest

from src.inventory_tracker import (
    AuditEntry,
    InventoryRecord,
    InventoryReadModel,
    InventoryStore,
    InventoryTracker,
    ManualClock,
    ReservationStatus,
    StockAdjustment,
    TransferRequest,
    bulk_normalize_skus,
    generate_transfer_id,
    normalize_sku,
    sku_fingerprint,
)


# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------


def make_store(
    *,
    tenant: str = "tenant-a",
    warehouses: dict[str, int] | None = None,
    sku: str = "SKU-WIDGET-01",
) -> InventoryStore:
    """Create a store with stock distributed across warehouses."""
    store = InventoryStore()
    wh_stock = warehouses or {"wh-east": 50, "wh-west": 30}
    for wh_id, available in wh_stock.items():
        store.upsert(
            InventoryRecord(
                tenant_id=tenant,
                warehouse_id=wh_id,
                sku=sku,
                available=available,
            )
        )
    return store


def make_tracker(
    store: InventoryStore | None = None,
    *,
    clock: ManualClock | None = None,
    tenant: str = "tenant-a",
) -> InventoryTracker:
    """Create tracker with injected clock and pre-published read model."""
    s = store or make_store()
    clk = clock or ManualClock(1000.0)
    tracker = InventoryTracker(s, clock=clk, tenant_id=tenant)
    tracker.publish_snapshot()
    return tracker


# ---------------------------------------------------------------------------
# Reservation tests
# ---------------------------------------------------------------------------


class TestReservation:
    def test_reserve_decrements_available_and_increments_reserved(self) -> None:
        store = make_store()
        tracker = make_tracker(store)

        reservation = tracker.reserve("wh-east", "SKU-WIDGET-01", 5, "worker-1")

        record = store.get_or_raise("tenant-a", "wh-east", "SKU-WIDGET-01")
        assert record.available == 45
        assert record.reserved == 5
        assert reservation.quantity == 5
        assert reservation.status == ReservationStatus.ACTIVE

    def test_reserve_insufficient_stock_raises(self) -> None:
        tracker = make_tracker()

        with pytest.raises(ValueError, match="Insufficient stock"):
            tracker.reserve("wh-east", "SKU-WIDGET-01", 999, "worker-1")

    def test_reserve_creates_audit_entry(self) -> None:
        store = make_store()
        tracker = make_tracker(store)

        reservation = tracker.reserve("wh-east", "SKU-WIDGET-01", 3, "worker-1")

        assert len(store.audit_log) == 1
        entry = store.audit_log[0]
        assert entry.event == "stock_reserved"
        assert entry.quantity == 3
        assert entry.metadata["reservation_id"] == reservation.reservation_id

    def test_release_returns_stock_to_available(self) -> None:
        store = make_store()
        tracker = make_tracker(store)

        reservation = tracker.reserve("wh-east", "SKU-WIDGET-01", 10, "worker-1")
        tracker.release_reservation(reservation.reservation_id)

        record = store.get_or_raise("tenant-a", "wh-east", "SKU-WIDGET-01")
        assert record.available == 50
        assert record.reserved == 0

    def test_release_unknown_reservation_raises(self) -> None:
        tracker = make_tracker()

        with pytest.raises(KeyError, match="Unknown reservation"):
            tracker.release_reservation("res-nonexistent")

    def test_fulfill_removes_from_reserved(self) -> None:
        store = make_store()
        tracker = make_tracker(store)

        reservation = tracker.reserve("wh-east", "SKU-WIDGET-01", 7, "worker-1")
        tracker.fulfill_reservation(reservation.reservation_id)

        record = store.get_or_raise("tenant-a", "wh-east", "SKU-WIDGET-01")
        assert record.available == 43
        assert record.reserved == 0
        assert reservation.status == ReservationStatus.FULFILLED

    def test_multiple_reservations_accumulate(self) -> None:
        store = make_store()
        tracker = make_tracker(store)

        tracker.reserve("wh-east", "SKU-WIDGET-01", 10, "worker-1")
        tracker.reserve("wh-east", "SKU-WIDGET-01", 15, "worker-2")

        record = store.get_or_raise("tenant-a", "wh-east", "SKU-WIDGET-01")
        assert record.available == 25
        assert record.reserved == 25


# ---------------------------------------------------------------------------
# Expiry tests
# ---------------------------------------------------------------------------


class TestExpiry:
    def test_expire_stale_reservations_releases_stock(self) -> None:
        clock = ManualClock(1000.0)
        store = make_store()
        tracker = make_tracker(store, clock=clock)

        reservation = tracker.reserve(
            "wh-east", "SKU-WIDGET-01", 5, "worker-1", ttl_seconds=60.0
        )
        assert reservation.expires_at == 1060.0

        clock.advance(61.0)
        expired = tracker.expire_stale_reservations()

        assert reservation.reservation_id in expired
        record = store.get_or_raise("tenant-a", "wh-east", "SKU-WIDGET-01")
        assert record.available == 50
        assert record.reserved == 0

    def test_non_expired_reservations_remain_active(self) -> None:
        clock = ManualClock(1000.0)
        tracker = make_tracker(clock=clock)

        reservation = tracker.reserve(
            "wh-east", "SKU-WIDGET-01", 5, "worker-1", ttl_seconds=120.0
        )
        clock.advance(60.0)
        expired = tracker.expire_stale_reservations()

        assert expired == []
        assert reservation.status == ReservationStatus.ACTIVE


# ---------------------------------------------------------------------------
# Transfer tests
# ---------------------------------------------------------------------------


class TestTransfer:
    def test_transfer_moves_stock_between_warehouses(self) -> None:
        store = make_store()
        tracker = make_tracker(store)

        result = tracker.transfer(
            TransferRequest(
                transfer_id="xfr-001",
                tenant_id="tenant-a",
                sku="SKU-WIDGET-01",
                source_warehouse_id="wh-east",
                destination_warehouse_id="wh-west",
                quantity=20,
                requested_by="logistics-1",
            )
        )

        assert result == {"source_available": 30, "destination_available": 50}

    def test_transfer_insufficient_stock_raises(self) -> None:
        tracker = make_tracker()

        with pytest.raises(ValueError, match="Insufficient source stock"):
            tracker.transfer(
                TransferRequest(
                    transfer_id="xfr-002",
                    tenant_id="tenant-a",
                    sku="SKU-WIDGET-01",
                    source_warehouse_id="wh-east",
                    destination_warehouse_id="wh-west",
                    quantity=999,
                    requested_by="logistics-1",
                )
            )

    def test_transfer_creates_audit_entry(self) -> None:
        store = make_store()
        tracker = make_tracker(store)

        tracker.transfer(
            TransferRequest(
                transfer_id="xfr-003",
                tenant_id="tenant-a",
                sku="SKU-WIDGET-01",
                source_warehouse_id="wh-east",
                destination_warehouse_id="wh-west",
                quantity=5,
                requested_by="logistics-1",
            )
        )

        entry = store.audit_log[-1]
        assert entry.event == "stock_transferred"
        assert entry.metadata["transfer_id"] == "xfr-003"
        assert entry.metadata["destination"] == "wh-west"


# ---------------------------------------------------------------------------
# Adjustment tests
# ---------------------------------------------------------------------------


class TestAdjustment:
    def test_apply_adjustment_increases_stock(self) -> None:
        store = make_store()
        tracker = make_tracker(store)

        result = tracker.apply_adjustment(
            StockAdjustment(
                tenant_id="tenant-a",
                adjustment_id="adj-cycle-001",
                warehouse_id="wh-east",
                sku="SKU-WIDGET-01",
                quantity=12,
                reason_code="cycle-count",
                requested_by="admin-1",
            )
        )

        assert result == 62

    def test_apply_adjustment_negative_decreases_stock(self) -> None:
        store = make_store()
        tracker = make_tracker(store)

        result = tracker.apply_adjustment(
            StockAdjustment(
                tenant_id="tenant-a",
                adjustment_id="adj-damage-001",
                warehouse_id="wh-east",
                sku="SKU-WIDGET-01",
                quantity=-3,
                reason_code="damage-report",
                requested_by="admin-1",
            )
        )

        assert result == 47

    def test_duplicate_adjustment_is_noop(self) -> None:
        store = make_store()
        tracker = make_tracker(store)

        adj = StockAdjustment(
            tenant_id="tenant-a",
            adjustment_id="adj-001",
            warehouse_id="wh-east",
            sku="SKU-WIDGET-01",
            quantity=10,
            reason_code="cycle-count",
            requested_by="admin-1",
        )

        first = tracker.apply_adjustment(adj)
        second = tracker.apply_adjustment(adj)

        assert first == 60
        assert second == 60

    def test_adjustment_creates_audit_entry(self) -> None:
        store = make_store()
        tracker = make_tracker(store)

        tracker.apply_adjustment(
            StockAdjustment(
                tenant_id="tenant-a",
                adjustment_id="adj-002",
                warehouse_id="wh-east",
                sku="SKU-WIDGET-01",
                quantity=5,
                reason_code="cycle-count",
                requested_by="admin-1",
            )
        )

        entry = store.audit_log[-1]
        assert entry.event == "stock_adjusted"
        assert entry.metadata["reason_code"] == "cycle-count"


# ---------------------------------------------------------------------------
# Reconciliation tests
# ---------------------------------------------------------------------------


class TestReconciliation:
    def test_reconcile_leaves_positive_stock_unchanged(self) -> None:
        store = make_store()
        tracker = make_tracker(store)

        result = tracker.reconcile("tenant-a", "SKU-WIDGET-01")

        assert result.warehouses_scanned == 2
        assert result.adjustments_made == 0
        assert result.negative_counts_zeroed == 0

    def test_reconcile_zeros_negative_available(self) -> None:
        store = make_store()
        record = store.get_or_raise("tenant-a", "wh-east", "SKU-WIDGET-01")
        record.available = -5

        tracker = make_tracker(store)
        result = tracker.reconcile("tenant-a", "SKU-WIDGET-01")

        assert result.negative_counts_zeroed == 1
        assert record.available == 0

    def test_reconcile_produces_audit_for_corrections(self) -> None:
        store = make_store()
        record = store.get_or_raise("tenant-a", "wh-east", "SKU-WIDGET-01")
        record.available = -8

        tracker = make_tracker(store)
        tracker.reconcile("tenant-a", "SKU-WIDGET-01")

        reconcile_entries = [
            e for e in store.audit_log if e.event == "reconciled_to_zero"
        ]
        assert len(reconcile_entries) == 1
        assert reconcile_entries[0].metadata["original_value"] == "-8"


# ---------------------------------------------------------------------------
# Clock injection tests
# ---------------------------------------------------------------------------


class TestClockInjection:
    def test_injected_clock_controls_reservation_timestamps(self) -> None:
        clock = ManualClock(5000.0)
        tracker = make_tracker(clock=clock)

        reservation = tracker.reserve(
            "wh-east", "SKU-WIDGET-01", 2, "worker-1", ttl_seconds=90.0
        )

        assert reservation.created_at == 5000.0
        assert reservation.expires_at == 5090.0

    def test_clock_advance_affects_subsequent_operations(self) -> None:
        clock = ManualClock(1000.0)
        store = make_store()
        tracker = make_tracker(store, clock=clock)

        tracker.reserve("wh-east", "SKU-WIDGET-01", 2, "worker-1")
        clock.advance(30.0)
        tracker.reserve("wh-east", "SKU-WIDGET-01", 3, "worker-2")

        assert store.audit_log[0].timestamp == 1000.0
        assert store.audit_log[1].timestamp == 1030.0

    def test_separate_tracker_instances_have_independent_clocks(self) -> None:
        clock_a = ManualClock(100.0)
        clock_b = ManualClock(9999.0)

        tracker_a = make_tracker(clock=clock_a)
        tracker_b = make_tracker(clock=clock_b)

        res_a = tracker_a.reserve("wh-east", "SKU-WIDGET-01", 1, "worker-1")
        res_b = tracker_b.reserve("wh-east", "SKU-WIDGET-01", 1, "worker-2")

        assert res_a.created_at == 100.0
        assert res_b.created_at == 9999.0


# ---------------------------------------------------------------------------
# SKU normalization tests
# ---------------------------------------------------------------------------


class TestSKUNormalization:
    def test_normalize_trims_and_uppercases(self) -> None:
        assert normalize_sku("  sku-widget-01 ") == "SKU-WIDGET-01"

    def test_normalize_empty_returns_empty(self) -> None:
        assert normalize_sku("   ") == ""

    def test_fingerprint_is_stable(self) -> None:
        fp1 = sku_fingerprint("sku-widget-01", "wh-east")
        fp2 = sku_fingerprint("SKU-WIDGET-01", "wh-east")
        assert fp1 == fp2

    def test_bulk_normalize_deduplicates(self) -> None:
        result = bulk_normalize_skus(["abc", "ABC", "def", " abc "])
        assert result == ["ABC", "DEF"]


# ---------------------------------------------------------------------------
# Utility tests
# ---------------------------------------------------------------------------


class TestUtilities:
    def test_generate_transfer_id_deterministic(self) -> None:
        id1 = generate_transfer_id("wh-east", "wh-west", "SKU-01", 1000.0)
        id2 = generate_transfer_id("wh-east", "wh-west", "SKU-01", 1000.0)
        assert id1 == id2
        assert id1.startswith("xfr-")

    def test_stock_summary_returns_all_fields(self) -> None:
        store = make_store()
        tracker = make_tracker(store)
        tracker.reserve("wh-east", "SKU-WIDGET-01", 8, "worker-1")

        summary = tracker.stock_summary("wh-east", "SKU-WIDGET-01")

        assert summary == {"available": 42, "reserved": 8, "total_on_hand": 50}

    def test_audit_trail_returns_newest_first(self) -> None:
        clock = ManualClock(100.0)
        store = make_store()
        tracker = make_tracker(store, clock=clock)

        tracker.reserve("wh-east", "SKU-WIDGET-01", 1, "worker-1")
        clock.advance(10.0)
        tracker.reserve("wh-east", "SKU-WIDGET-01", 1, "worker-2")

        trail = tracker.audit_trail("wh-east", "SKU-WIDGET-01")
        assert trail[0].timestamp > trail[1].timestamp

    def test_active_reservations_filters_by_status(self) -> None:
        store = make_store()
        tracker = make_tracker(store)

        res1 = tracker.reserve("wh-east", "SKU-WIDGET-01", 2, "worker-1")
        res2 = tracker.reserve("wh-east", "SKU-WIDGET-01", 3, "worker-2")
        tracker.fulfill_reservation(res1.reservation_id)

        active = tracker.active_reservations("wh-east", "SKU-WIDGET-01")
        assert len(active) == 1
        assert active[0].reservation_id == res2.reservation_id
