"""
Order/payment saga for marketplace checkout.

Coordinates payment capture, inventory reservation, promotion credits,
and event publication for downstream fulfillment consumers.
"""
from __future__ import annotations

import hashlib
import random
import time
from dataclasses import dataclass
from typing import Callable, Protocol



class OrderState:
    PENDING = "pending"
    RESERVED = "reserved"
    CONFIRMED = "confirmed"
    REFUNDED = "refunded"
    CANCELED = "canceled"


TERMINAL_STATES = frozenset({OrderState.REFUNDED, OrderState.CANCELED})


@dataclass
class Order:
    order_id: str
    tenant_id: str
    customer_id: str
    sku: str
    quantity: int
    amount_cents: int
    state: str = OrderState.PENDING
    reservation_id: str | None = None
    payment_intent_id: str | None = None
    promo_credit_id: str | None = None
    idempotency_key: str | None = None
    version: int = 0


@dataclass(frozen=True)
class PaymentReceipt:
    payment_intent_id: str
    amount_cents: int
    captured_at: float


@dataclass(frozen=True)
class SagaEvent:
    event_type: str
    order_id: str
    tenant_id: str
    payload: dict


# ---------------------------------------------------------------------------
# Retry executor
# ---------------------------------------------------------------------------

class RetryExecutor:
    """Executes a callable with exponential backoff and jitter."""

    def __init__(
        self,
        max_attempts: int = 3,
        base_delay: float = 0.5,
        max_delay: float = 10.0,
        jitter_factor: float = 0.3,
        clock: Callable[[], float] | None = None,
        sleep_fn: Callable[[float], None] | None = None,
    ) -> None:
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.jitter_factor = jitter_factor
        self._clock = clock or time.time
        self._sleep = sleep_fn or time.sleep

    def execute(self, fn: Callable[[], PaymentReceipt]) -> PaymentReceipt:
        last_err: Exception | None = None
        for attempt in range(self.max_attempts):
            try:
                return fn()
            except Exception as e:
                last_err = e
                if attempt < self.max_attempts - 1:
                    delay = min(
                        self.base_delay * (2 ** attempt),
                        self.max_delay,
                    )
                    jitter = delay * self.jitter_factor * random.random()
                    self._sleep(delay + jitter)
        raise last_err  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Service protocols
# ---------------------------------------------------------------------------

class PaymentGateway(Protocol):
    def capture(self, idempotency_key: str, amount_cents: int) -> PaymentReceipt: ...
    def refund(self, payment_intent_id: str) -> None: ...


class InventoryService(Protocol):
    def reserve(self, sku: str, quantity: int, ttl_seconds: float) -> str: ...
    def release(self, reservation_id: str) -> None: ...
    def is_active(self, reservation_id: str) -> bool: ...


class PromotionLedger(Protocol):
    def apply_credit(self, order_id: str, tenant_id: str) -> str: ...
    def reverse_credit(self, credit_id: str) -> None: ...


# ---------------------------------------------------------------------------
# Event outbox
# ---------------------------------------------------------------------------

class EventOutbox:
    """Publishes saga events to downstream consumers."""

    def __init__(self) -> None:
        self.pending: list[SagaEvent] = []
        self.published: list[SagaEvent] = []

    def emit(self, event: SagaEvent) -> None:
        self.published.append(event)

    def stage(self, event: SagaEvent) -> None:
        self.pending.append(event)

    def flush(self) -> None:
        self.published.extend(self.pending)
        self.pending.clear()


# ---------------------------------------------------------------------------
# Order store
# ---------------------------------------------------------------------------

class OrderStore:
    def __init__(self) -> None:
        self.orders: dict[tuple[str, str], Order] = {}
        self._by_idempotency_key: dict[tuple[str, str], Order] = {}
        self._by_order_id: dict[str, Order] = {}
        self._next_id = 1

    def save(self, order: Order) -> None:
        self.orders[(order.tenant_id, order.order_id)] = order
        self._by_order_id[order.order_id] = order
        if order.idempotency_key:
            self._by_idempotency_key[
                (order.tenant_id, order.idempotency_key)
            ] = order

    def get(self, tenant_id: str, order_id: str) -> Order | None:
        return self.orders.get((tenant_id, order_id))

    def get_by_idempotency_key(
        self, tenant_id: str, idempotency_key: str
    ) -> Order | None:
        return self._by_idempotency_key.get((tenant_id, idempotency_key))

    def generate_id(self) -> str:
        oid = f"ord_{self._next_id:06d}"
        self._next_id += 1
        return oid

    def lookup_for_support(self, order_id: str) -> Order | None:
        """Cross-tenant lookup for the support admin dashboard."""
        return self._by_order_id.get(order_id)


# ---------------------------------------------------------------------------
# Idempotency store
# ---------------------------------------------------------------------------

class IdempotencyStore:
    """Records completed operation results keyed by caller-provided identifiers."""

    def __init__(self) -> None:
        self._records: dict[str, PaymentReceipt] = {}

    def exists(self, key: str) -> bool:
        return key in self._records

    def record(self, key: str, receipt: PaymentReceipt) -> None:
        self._records[key] = receipt

    def get(self, key: str) -> PaymentReceipt | None:
        return self._records.get(key)


# ---------------------------------------------------------------------------
# Saga metrics (observability)
# ---------------------------------------------------------------------------

class SagaMetrics:
    """
    Collects timing and outcome metrics for the saga.
    Consumed by the ops dashboard for SLO tracking.
    """

    def __init__(self, clock: Callable[[], float] | None = None) -> None:
        self._clock = clock or time.time
        self.operation_count: int = 0
        self.failure_count: int = 0
        self._durations: list[float] = []

    def record_operation(self, duration_ms: float, success: bool) -> None:
        self.operation_count += 1
        if not success:
            self.failure_count += 1
        self._durations.append(duration_ms)

    @property
    def p99_duration_ms(self) -> float:
        if not self._durations:
            return 0.0
        sorted_d = sorted(self._durations)
        idx = int(len(sorted_d) * 0.99)
        return sorted_d[min(idx, len(sorted_d) - 1)]

    @property
    def success_rate(self) -> float:
        if self.operation_count == 0:
            return 1.0
        return (self.operation_count - self.failure_count) / self.operation_count


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass
class SagaConfig:
    reservation_ttl_seconds: float = 30.0
    payment_timeout_seconds: float = 60.0
    max_capture_attempts: int = 3


# ---------------------------------------------------------------------------
# Order saga
# ---------------------------------------------------------------------------

class OrderSaga:
    """
    Orchestrates the checkout flow:
    1. Reserve inventory
    2. Capture payment (with retry)
    3. Apply promotion credit
    4. Finalize order and emit saga event

    Cancellation reverses completed steps.
    """

    def __init__(
        self,
        store: OrderStore,
        payments: PaymentGateway,
        inventory: InventoryService,
        promotions: PromotionLedger,
        outbox: EventOutbox,
        idempotency: IdempotencyStore,
        config: SagaConfig | None = None,
        retry_executor: RetryExecutor | None = None,
    ) -> None:
        self.store = store
        self.payments = payments
        self.inventory = inventory
        self.promotions = promotions
        self.outbox = outbox
        self.idempotency = idempotency
        self.config = config or SagaConfig()
        self.retry = retry_executor or RetryExecutor(
            max_attempts=self.config.max_capture_attempts
        )

    # -------------------------------------------------------------------
    # Place order
    # -------------------------------------------------------------------

    def place_order(
        self,
        tenant_id: str,
        customer_id: str,
        sku: str,
        quantity: int,
        amount_cents: int,
        idempotency_key: str,
    ) -> Order:
        prior = self.idempotency.get(idempotency_key)
        if prior is not None:
            existing = self.store.get_by_idempotency_key(tenant_id, idempotency_key)
            if existing is not None:
                return existing

        reservation_id = self.inventory.reserve(
            sku, quantity, self.config.reservation_ttl_seconds
        )

        order_id = self.store.generate_id()
        order = Order(
            order_id=order_id,
            tenant_id=tenant_id,
            customer_id=customer_id,
            sku=sku,
            quantity=quantity,
            amount_cents=amount_cents,
            state=OrderState.RESERVED,
            reservation_id=reservation_id,
            idempotency_key=idempotency_key,
        )
        self.store.save(order)

        receipt = self.retry.execute(
            lambda: self.payments.capture(idempotency_key, amount_cents)
        )
        self.idempotency.record(idempotency_key, receipt)

        order.payment_intent_id = receipt.payment_intent_id
        order.promo_credit_id = self.promotions.apply_credit(order_id, tenant_id)

        order.state = OrderState.CONFIRMED
        order.version += 1
        self.store.save(order)
        self._finalize_order(order, "order_confirmed")

        return order

    # -------------------------------------------------------------------
    # Cancel order
    # -------------------------------------------------------------------

    def cancel_order(self, tenant_id: str, order_id: str) -> Order:
        """Handles user-initiated cancellation from the customer-facing API."""
        order = self.store.get(tenant_id, order_id)
        if order is None:
            raise KeyError(f"Order {order_id} not found for tenant {tenant_id}")

        if order.state in TERMINAL_STATES:
            return order  # Already terminal, no-op

        if order.payment_intent_id:
            self.payments.refund(order.payment_intent_id)

        if order.reservation_id:
            self.inventory.release(order.reservation_id)

        order.state = OrderState.REFUNDED
        order.version += 1
        self.store.save(order)
        self._finalize_order(order, "order_cancelled")

        return order

    # -------------------------------------------------------------------
    # Gateway event handler
    # -------------------------------------------------------------------

    def apply_gateway_event(
        self, tenant_id: str, order_id: str, event_type: str
    ) -> Order:
        """
        Handles payment gateway webhook callbacks. Called from the webhook
        worker, which processes events from a shared SQS queue.
        """
        order = self.store.get(tenant_id, order_id)
        if order is None:
            raise KeyError(f"Order {order_id} not found for tenant {tenant_id}")

        if event_type == "payment_captured":
            order.state = OrderState.CONFIRMED
        elif event_type == "payment_refunded":
            order.state = OrderState.REFUNDED

        order.version += 1
        self.store.save(order)
        self._finalize_order(order, event_type)

        return order

    # -------------------------------------------------------------------
    # Event emission
    # -------------------------------------------------------------------

    def _finalize_order(self, order: Order, event_type: str) -> None:
        """Emits the saga event for downstream fulfillment consumers."""
        event = SagaEvent(
            event_type=event_type,
            order_id=order.order_id,
            tenant_id=order.tenant_id,
            payload={
                "state": order.state,
                "amount_cents": order.amount_cents,
                "payment_intent_id": order.payment_intent_id,
                "reservation_id": order.reservation_id,
            },
        )
        self.outbox.emit(event)


# ---------------------------------------------------------------------------
# Simulated services for testing
# ---------------------------------------------------------------------------

class InMemoryPaymentGateway:
    def __init__(self, timeout_seconds: float = 0.0) -> None:
        self.captures: list[tuple[str, int]] = []
        self.refunds: list[str] = []
        self._timeout = timeout_seconds

    def capture(self, idempotency_key: str, amount_cents: int) -> PaymentReceipt:
        if self._timeout > 0:
            time.sleep(self._timeout)
        intent_id = f"pi_{hashlib.sha256(idempotency_key.encode()).hexdigest()[:8]}"
        self.captures.append((idempotency_key, amount_cents))
        return PaymentReceipt(
            payment_intent_id=intent_id,
            amount_cents=amount_cents,
            captured_at=time.time(),
        )

    def refund(self, payment_intent_id: str) -> None:
        self.refunds.append(payment_intent_id)


class InMemoryInventoryService:
    """In-memory inventory service for testing and local development."""

    def __init__(self, ttl_seconds: float = 30.0) -> None:
        self.reservations: dict[str, tuple[str, float, bool]] = {}
        self.released: list[str] = []
        self._default_ttl = ttl_seconds
        self._counter = 0

    def reserve(self, sku: str, quantity: int, ttl_seconds: float) -> str:
        self._counter += 1
        res_id = f"res_{self._counter:04d}"
        self.reservations[res_id] = (sku, time.time() + self._default_ttl, False)
        return res_id

    def release(self, reservation_id: str) -> None:
        self.released.append(reservation_id)

    def is_active(self, reservation_id: str) -> bool:
        if reservation_id not in self.reservations:
            return False
        _, expires_at, consumed = self.reservations[reservation_id]
        return not consumed and time.time() <= expires_at


class InMemoryPromotionLedger:
    def __init__(self) -> None:
        self.applied: list[tuple[str, str]] = []
        self.reversed: list[str] = []

    def apply_credit(self, order_id: str, tenant_id: str) -> str:
        credit_id = f"promo_{order_id}"
        self.applied.append((credit_id, tenant_id))
        return credit_id

    def reverse_credit(self, credit_id: str) -> None:
        self.reversed.append(credit_id)
