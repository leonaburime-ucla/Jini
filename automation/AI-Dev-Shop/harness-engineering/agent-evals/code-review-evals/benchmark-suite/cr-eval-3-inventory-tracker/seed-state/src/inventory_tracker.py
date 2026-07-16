"""Inventory reservation, transfer, and reconciliation service.

Supports multi-warehouse stock management with concurrent reservation handling,
inter-warehouse transfers, admin stock adjustments from cycle counts and damage
reports, and a weekly reconciliation job that ensures counts stay consistent.
"""
from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol


# ---------------------------------------------------------------------------
# Clock abstraction
# ---------------------------------------------------------------------------


class Clock(Protocol):
    """Minimal clock interface for reservation expiry timestamps."""

    def now(self) -> float: ...


@dataclass
class ManualClock:
    """Deterministic clock for testing. Injected via constructor DI."""

    current_time: float = 0.0

    def now(self) -> float:
        return self.current_time

    def advance(self, seconds: float) -> None:
        self.current_time += seconds


DEFAULT_CLOCK: ManualClock = ManualClock()
CURRENT_TENANT: str = "default-tenant"


# ---------------------------------------------------------------------------
# Domain value objects
# ---------------------------------------------------------------------------


class ReservationStatus(Enum):
    ACTIVE = "active"
    RELEASED = "released"
    EXPIRED = "expired"
    FULFILLED = "fulfilled"


@dataclass
class InventoryRecord:
    """Warehouse-level stock record for a single SKU."""

    tenant_id: str
    warehouse_id: str
    sku: str
    available: int
    reserved: int = 0
    version: int = 1

    @property
    def total_on_hand(self) -> int:
        return self.available + self.reserved


@dataclass
class Reservation:
    reservation_id: str
    tenant_id: str
    warehouse_id: str
    sku: str
    quantity: int
    requester_id: str
    created_at: float
    expires_at: float
    status: ReservationStatus = ReservationStatus.ACTIVE


@dataclass(frozen=True)
class TransferRequest:
    transfer_id: str
    tenant_id: str
    sku: str
    source_warehouse_id: str
    destination_warehouse_id: str
    quantity: int
    requested_by: str


@dataclass(frozen=True)
class StockAdjustment:
    tenant_id: str
    adjustment_id: str
    warehouse_id: str
    sku: str
    quantity: int
    reason_code: str
    requested_by: str


@dataclass
class AuditEntry:
    timestamp: float
    event: str
    tenant_id: str
    warehouse_id: str
    sku: str
    quantity: int
    actor_id: str
    metadata: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class ReconciliationResult:
    """Summary of a single reconciliation pass for one SKU."""

    tenant_id: str
    sku: str
    warehouses_scanned: int
    adjustments_made: int
    negative_counts_zeroed: int


# ---------------------------------------------------------------------------
# Persistence layer
# ---------------------------------------------------------------------------


class InventoryStore:
    """In-memory inventory persistence with record-level operations."""

    def __init__(self) -> None:
        self.records: dict[tuple[str, str, str], InventoryRecord] = {}
        self.audit_log: list[AuditEntry] = []

    def upsert(self, record: InventoryRecord) -> None:
        key = (record.tenant_id, record.warehouse_id, record.sku)
        self.records[key] = record

    def get(self, tenant_id: str, warehouse_id: str, sku: str) -> InventoryRecord | None:
        return self.records.get((tenant_id, warehouse_id, sku))

    def get_or_raise(self, tenant_id: str, warehouse_id: str, sku: str) -> InventoryRecord:
        record = self.get(tenant_id, warehouse_id, sku)
        if record is None:
            raise KeyError(f"No record for {tenant_id}/{warehouse_id}/{sku}")
        return record

    def list_by_sku(self, tenant_id: str, sku: str) -> list[InventoryRecord]:
        """Return all warehouse records for a tenant+SKU pair."""
        return [
            rec
            for (t, _w, s), rec in self.records.items()
            if t == tenant_id and s == sku
        ]

    def append_audit(self, entry: AuditEntry) -> None:
        self.audit_log.append(entry)


# ---------------------------------------------------------------------------
# Read model (eventually consistent projection)
# ---------------------------------------------------------------------------


class InventoryReadModel:
    """Eventually-consistent availability projection.

    Published periodically from the write store. Queries are fast but may
    reflect stale data.
    """

    def __init__(self) -> None:
        self._snapshots: dict[tuple[str, str, str], int] = {}

    def publish(self, store: InventoryStore) -> None:
        """Rebuild the entire read model from current store state."""
        self._snapshots = {
            key: record.available for key, record in store.records.items()
        }

    def available(self, tenant_id: str, warehouse_id: str, sku: str) -> int:
        return self._snapshots.get((tenant_id, warehouse_id, sku), 0)

    def total_available(self, tenant_id: str, sku: str) -> int:
        """Sum available across all warehouses for a SKU."""
        return sum(
            qty
            for (t, _w, s), qty in self._snapshots.items()
            if t == tenant_id and s == sku
        )


# ---------------------------------------------------------------------------
# SKU normalization utilities
# ---------------------------------------------------------------------------


def normalize_sku(raw: str) -> str:
    """Normalize SKU to uppercase with trimmed whitespace."""
    return raw.strip().upper()


def sku_fingerprint(sku: str, warehouse_id: str) -> str:
    """Stable hash for deduplication in external batch systems."""
    payload = f"{normalize_sku(sku)}:{warehouse_id}"
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Core service
# ---------------------------------------------------------------------------


class InventoryTracker:
    """Coordinates reservation, transfer, adjustment, and reconciliation."""

    def __init__(
        self,
        store: InventoryStore,
        *,
        clock: ManualClock | None = None,
        tenant_id: str | None = None,
        read_model: InventoryReadModel | None = None,
    ) -> None:
        self.store = store
        self.clock = clock or DEFAULT_CLOCK
        self.tenant_id = tenant_id or CURRENT_TENANT
        self.read_model = read_model or InventoryReadModel()
        self.reservations: dict[str, Reservation] = {}
        self._applied_adjustments: set[str] = set()

    # ------------------------------------------------------------------
    # Read model lifecycle
    # ------------------------------------------------------------------

    def publish_snapshot(self) -> None:
        """Refresh the read model from current store state."""
        self.read_model.publish(self.store)

    def get_availability(self, warehouse_id: str, sku: str) -> int:
        """Query projected availability for display or pre-checks."""
        return self.read_model.available(self.tenant_id, warehouse_id, sku)

    # ------------------------------------------------------------------
    # Reservation workflow
    # ------------------------------------------------------------------

    def reserve(
        self,
        warehouse_id: str,
        sku: str,
        quantity: int,
        requester_id: str,
        *,
        ttl_seconds: float = 300.0,
    ) -> Reservation:
        """Reserve stock for checkout."""
        projected = self.read_model.available(self.tenant_id, warehouse_id, sku)
        if projected < quantity:
            raise ValueError(
                f"Insufficient stock: requested {quantity}, available {projected}"
            )

        record = self.store.get_or_raise(self.tenant_id, warehouse_id, sku)
        record.available -= quantity
        record.reserved += quantity

        now = self.clock.now()
        reservation = Reservation(
            reservation_id=f"res-{uuid.uuid4().hex[:8]}",
            tenant_id=self.tenant_id,
            warehouse_id=warehouse_id,
            sku=sku,
            quantity=quantity,
            requester_id=requester_id,
            created_at=now,
            expires_at=now + ttl_seconds,
        )
        self.reservations[reservation.reservation_id] = reservation

        self.store.append_audit(
            AuditEntry(
                timestamp=now,
                event="stock_reserved",
                tenant_id=self.tenant_id,
                warehouse_id=warehouse_id,
                sku=sku,
                quantity=quantity,
                actor_id=requester_id,
                metadata={"reservation_id": reservation.reservation_id},
            )
        )
        return reservation

    def release_reservation(self, reservation_id: str) -> None:
        """Release a held reservation, returning stock to available pool."""
        reservation = self.reservations.get(reservation_id)
        if reservation is None:
            raise KeyError(f"Unknown reservation: {reservation_id}")
        if reservation.status != ReservationStatus.ACTIVE:
            raise ValueError(f"Cannot release reservation in state {reservation.status}")

        record = self.store.get_or_raise(
            reservation.tenant_id,
            reservation.warehouse_id,
            reservation.sku,
        )

        record.reserved -= reservation.quantity
        record.available += reservation.quantity

        reservation.status = ReservationStatus.RELEASED

        self.store.append_audit(
            AuditEntry(
                timestamp=self.clock.now(),
                event="reservation_released",
                tenant_id=reservation.tenant_id,
                warehouse_id=reservation.warehouse_id,
                sku=reservation.sku,
                quantity=reservation.quantity,
                actor_id=reservation.requester_id,
                metadata={"reservation_id": reservation_id},
            )
        )

    def fulfill_reservation(self, reservation_id: str) -> None:
        """Mark reservation as fulfilled (stock leaves warehouse)."""
        reservation = self.reservations.get(reservation_id)
        if reservation is None:
            raise KeyError(f"Unknown reservation: {reservation_id}")
        if reservation.status != ReservationStatus.ACTIVE:
            raise ValueError(
                f"Cannot fulfill reservation in state {reservation.status}"
            )

        record = self.store.get_or_raise(
            reservation.tenant_id,
            reservation.warehouse_id,
            reservation.sku,
        )
        record.reserved -= reservation.quantity
        reservation.status = ReservationStatus.FULFILLED

        self.store.append_audit(
            AuditEntry(
                timestamp=self.clock.now(),
                event="reservation_fulfilled",
                tenant_id=reservation.tenant_id,
                warehouse_id=reservation.warehouse_id,
                sku=reservation.sku,
                quantity=reservation.quantity,
                actor_id=reservation.requester_id,
                metadata={"reservation_id": reservation_id},
            )
        )

    def expire_stale_reservations(self) -> list[str]:
        """Expire reservations past their TTL and release stock."""
        expired_ids: list[str] = []
        now = self.clock.now()
        for res in list(self.reservations.values()):
            if res.status == ReservationStatus.ACTIVE and res.expires_at <= now:
                self.release_reservation(res.reservation_id)
                res.status = ReservationStatus.EXPIRED
                expired_ids.append(res.reservation_id)
        return expired_ids

    # ------------------------------------------------------------------
    # Inter-warehouse transfer
    # ------------------------------------------------------------------

    def transfer(self, request: TransferRequest) -> dict[str, int]:
        """Transfer stock between warehouses."""
        source = self.store.get_or_raise(
            request.tenant_id,
            request.source_warehouse_id,
            request.sku,
        )
        if source.available < request.quantity:
            raise ValueError(
                f"Insufficient source stock: {source.available} < {request.quantity}"
            )

        source.available -= request.quantity

        destination = self.store.get_or_raise(
            request.tenant_id,
            request.destination_warehouse_id,
            request.sku,
        )
        destination.available += request.quantity

        self.store.append_audit(
            AuditEntry(
                timestamp=self.clock.now(),
                event="stock_transferred",
                tenant_id=request.tenant_id,
                warehouse_id=request.source_warehouse_id,
                sku=request.sku,
                quantity=request.quantity,
                actor_id=request.requested_by,
                metadata={
                    "transfer_id": request.transfer_id,
                    "destination": request.destination_warehouse_id,
                },
            )
        )

        return {
            "source_available": source.available,
            "destination_available": destination.available,
        }

    # ------------------------------------------------------------------
    # Stock adjustments (cycle counts, damage reports)
    # ------------------------------------------------------------------

    def _adjustment_idempotency_key(self, adj: StockAdjustment) -> str:
        """Compute idempotency key for deduplication."""
        return f"{adj.tenant_id}:{adj.adjustment_id}:{adj.sku}"

    def apply_adjustment(self, adjustment: StockAdjustment) -> int:
        """Apply an admin stock adjustment (cycle count or damage report).

        Idempotent: duplicate adjustment_ids for the same SKU are no-ops.
        """
        key = self._adjustment_idempotency_key(adjustment)
        if key in self._applied_adjustments:
            record = self.store.get_or_raise(
                adjustment.tenant_id,
                adjustment.warehouse_id,
                adjustment.sku,
            )
            return record.available

        record = self.store.get_or_raise(
            adjustment.tenant_id,
            adjustment.warehouse_id,
            adjustment.sku,
        )
        record.available += adjustment.quantity
        self._applied_adjustments.add(key)

        self.store.append_audit(
            AuditEntry(
                timestamp=self.clock.now(),
                event="stock_adjusted",
                tenant_id=adjustment.tenant_id,
                warehouse_id=adjustment.warehouse_id,
                sku=adjustment.sku,
                quantity=adjustment.quantity,
                actor_id=adjustment.requested_by,
                metadata={
                    "adjustment_id": adjustment.adjustment_id,
                    "reason_code": adjustment.reason_code,
                },
            )
        )
        return record.available

    # ------------------------------------------------------------------
    # Reconciliation (weekly batch job)
    # ------------------------------------------------------------------

    def reconcile(self, tenant_id: str, sku: str) -> ReconciliationResult:
        """Weekly reconciliation: walk all warehouse records for a SKU.

        Runs during the Sunday-night low-traffic window.
        """
        records = self.store.list_by_sku(tenant_id, sku)
        adjustments_made = 0
        negative_counts_zeroed = 0

        for record in records:
            if record.available < 0:
                deficit = record.available
                record.available = 0
                negative_counts_zeroed += 1
                adjustments_made += 1

                self.store.append_audit(
                    AuditEntry(
                        timestamp=self.clock.now(),
                        event="reconciled_to_zero",
                        tenant_id=tenant_id,
                        warehouse_id=record.warehouse_id,
                        sku=sku,
                        quantity=abs(deficit),
                        actor_id="system:reconciliation",
                        metadata={"original_value": str(deficit)},
                    )
                )

            if record.reserved > record.total_on_hand:
                overshoot = record.reserved - record.total_on_hand
                record.reserved = record.total_on_hand
                adjustments_made += 1

                self.store.append_audit(
                    AuditEntry(
                        timestamp=self.clock.now(),
                        event="reconciled_reserved",
                        tenant_id=tenant_id,
                        warehouse_id=record.warehouse_id,
                        sku=sku,
                        quantity=overshoot,
                        actor_id="system:reconciliation",
                    )
                )

        return ReconciliationResult(
            tenant_id=tenant_id,
            sku=sku,
            warehouses_scanned=len(records),
            adjustments_made=adjustments_made,
            negative_counts_zeroed=negative_counts_zeroed,
        )

    # ------------------------------------------------------------------
    # Reporting helpers
    # ------------------------------------------------------------------

    def stock_summary(self, warehouse_id: str, sku: str) -> dict[str, int]:
        """Return current stock state for a single warehouse+SKU."""
        record = self.store.get_or_raise(self.tenant_id, warehouse_id, sku)
        return {
            "available": record.available,
            "reserved": record.reserved,
            "total_on_hand": record.total_on_hand,
        }

    def active_reservations(self, warehouse_id: str, sku: str) -> list[Reservation]:
        """Return all active reservations for a warehouse+SKU."""
        return [
            res
            for res in self.reservations.values()
            if (
                res.warehouse_id == warehouse_id
                and res.sku == sku
                and res.status == ReservationStatus.ACTIVE
            )
        ]

    def audit_trail(
        self,
        warehouse_id: str,
        sku: str,
        *,
        limit: int = 50,
    ) -> list[AuditEntry]:
        """Return recent audit entries for a warehouse+SKU, newest first."""
        matching = [
            entry
            for entry in self.store.audit_log
            if (
                entry.tenant_id == self.tenant_id
                and entry.warehouse_id == warehouse_id
                and entry.sku == sku
            )
        ]
        return sorted(matching, key=lambda e: e.timestamp, reverse=True)[:limit]


# ---------------------------------------------------------------------------
# Batch import pipeline
# ---------------------------------------------------------------------------


@dataclass
class BatchImportItem:
    """A single line from a warehouse scanner batch file."""

    raw_sku: str
    warehouse_id: str
    scanned_quantity: int
    scan_timestamp: float
    operator_id: str


@dataclass
class BatchImportResult:
    """Summary of a batch import run."""

    items_processed: int
    items_skipped: int
    adjustments_created: list[StockAdjustment]


def process_batch_import(
    items: list[BatchImportItem],
    tenant_id: str,
    *,
    dedup_window_seconds: float = 300.0,
) -> BatchImportResult:
    """Process scanned items into stock adjustments with dedup window."""
    grouped: dict[tuple[str, str], BatchImportItem] = {}
    skipped = 0

    for item in items:
        normalized = normalize_sku(item.raw_sku)
        if not normalized:
            skipped += 1
            continue
        key = (normalized, item.warehouse_id)
        existing = grouped.get(key)
        if existing is not None:
            if (item.scan_timestamp - existing.scan_timestamp) < dedup_window_seconds:
                if item.scan_timestamp > existing.scan_timestamp:
                    grouped[key] = item
                skipped += 1
                continue
        grouped[key] = item

    adjustments: list[StockAdjustment] = []
    for (sku, warehouse_id), item in grouped.items():
        adj_id = f"batch-{sku_fingerprint(sku, warehouse_id)}-{int(item.scan_timestamp)}"
        adjustments.append(
            StockAdjustment(
                tenant_id=tenant_id,
                adjustment_id=adj_id,
                warehouse_id=warehouse_id,
                sku=sku,
                quantity=item.scanned_quantity,
                reason_code="batch-scan-import",
                requested_by=item.operator_id,
            )
        )

    return BatchImportResult(
        items_processed=len(grouped),
        items_skipped=skipped,
        adjustments_created=adjustments,
    )


# ---------------------------------------------------------------------------
# Batch utilities (used by scheduled jobs)
# ---------------------------------------------------------------------------


def bulk_normalize_skus(raw_skus: list[str]) -> list[str]:
    """Normalize a batch of scanned SKUs for import processing."""
    seen: set[str] = set()
    result: list[str] = []
    for raw in raw_skus:
        normalized = normalize_sku(raw)
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


def generate_transfer_id(
    source: str, destination: str, sku: str, timestamp: float
) -> str:
    """Generate a deterministic transfer ID for idempotent retry."""
    payload = f"{source}:{destination}:{sku}:{timestamp}"
    return f"xfr-{hashlib.sha256(payload.encode()).hexdigest()[:12]}"
