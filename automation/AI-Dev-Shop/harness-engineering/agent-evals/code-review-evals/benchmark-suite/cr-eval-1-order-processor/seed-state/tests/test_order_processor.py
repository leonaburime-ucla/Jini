"""Tests for the order/payment saga."""
from __future__ import annotations

from src.order_processor import (
    EventOutbox,
    IdempotencyStore,
    InMemoryInventoryService,
    InMemoryPaymentGateway,
    InMemoryPromotionLedger,
    OrderSaga,
    OrderState,
    OrderStore,
    RetryExecutor,
    SagaConfig,
)


def make_saga(
    payment_timeout: float = 0.0,
    reservation_ttl: float = 30.0,
) -> OrderSaga:
    return OrderSaga(
        store=OrderStore(),
        payments=InMemoryPaymentGateway(timeout_seconds=payment_timeout),
        inventory=InMemoryInventoryService(ttl_seconds=reservation_ttl),
        promotions=InMemoryPromotionLedger(),
        outbox=EventOutbox(),
        idempotency=IdempotencyStore(),
        config=SagaConfig(
            reservation_ttl_seconds=reservation_ttl,
            payment_timeout_seconds=60.0,
        ),
        retry_executor=RetryExecutor(max_attempts=3, sleep_fn=lambda _: None),
    )


class TestPlaceOrder:
    def test_happy_path_confirms_order(self) -> None:
        saga = make_saga()
        order = saga.place_order("t1", "cust1", "SKU-A", 2, 5000, "idem-1")

        assert order.state == OrderState.CONFIRMED
        assert order.payment_intent_id is not None
        assert order.reservation_id is not None
        assert order.promo_credit_id is not None

    def test_returns_existing_order_on_duplicate_idempotency_key(self) -> None:
        saga = make_saga()
        first = saga.place_order("t1", "cust1", "SKU-A", 1, 1000, "idem-dup")
        second = saga.place_order("t1", "cust1", "SKU-A", 1, 1000, "idem-dup")

        assert first.order_id == second.order_id

    def test_stores_order_with_tenant_scope(self) -> None:
        saga = make_saga()
        order = saga.place_order("t1", "cust1", "SKU-A", 1, 1000, "idem-2")

        assert saga.store.get("t1", order.order_id) is not None
        assert saga.store.get("t2", order.order_id) is None

    def test_emits_saga_event_on_confirmation(self) -> None:
        saga = make_saga()
        saga.place_order("t1", "cust1", "SKU-A", 1, 1000, "idem-3")

        assert len(saga.outbox.published) == 1
        assert saga.outbox.published[0].event_type == "order_confirmed"

    def test_retry_executor_retries_on_transient_failure(self) -> None:
        call_count = 0

        class FlakyGateway:
            def capture(self, key: str, amount: int):
                nonlocal call_count
                call_count += 1
                if call_count < 3:
                    raise Exception("transient")
                from src.order_processor import PaymentReceipt
                return PaymentReceipt("pi_retry", amount, 0.0)

            def refund(self, pid: str) -> None:
                pass

        saga = OrderSaga(
            store=OrderStore(),
            payments=FlakyGateway(),
            inventory=InMemoryInventoryService(),
            promotions=InMemoryPromotionLedger(),
            outbox=EventOutbox(),
            idempotency=IdempotencyStore(),
            retry_executor=RetryExecutor(max_attempts=3, sleep_fn=lambda _: None),
        )
        order = saga.place_order("t1", "c1", "SKU", 1, 100, "idem-retry")

        assert order.state == OrderState.CONFIRMED
        assert call_count == 3


class TestCancelOrder:
    def test_refunds_payment_and_releases_inventory(self) -> None:
        saga = make_saga()
        order = saga.place_order("t1", "cust1", "SKU-A", 1, 1000, "idem-4")

        cancelled = saga.cancel_order("t1", order.order_id)

        assert cancelled.state == OrderState.REFUNDED
        assert order.payment_intent_id in saga.payments.refunds
        assert order.reservation_id in saga.inventory.released

    def test_cancel_is_idempotent_for_terminal_orders(self) -> None:
        saga = make_saga()
        order = saga.place_order("t1", "cust1", "SKU-A", 1, 1000, "idem-5")
        saga.cancel_order("t1", order.order_id)

        # Second cancel should be a no-op
        result = saga.cancel_order("t1", order.order_id)
        assert result.state == OrderState.REFUNDED

    def test_emits_cancellation_event(self) -> None:
        saga = make_saga()
        order = saga.place_order("t1", "cust1", "SKU-A", 1, 1000, "idem-6")
        saga.cancel_order("t1", order.order_id)

        events = [e for e in saga.outbox.published if e.event_type == "order_cancelled"]
        assert len(events) == 1


class TestGatewayEvents:
    def test_payment_captured_confirms_order(self) -> None:
        saga = make_saga()
        order = saga.place_order("t1", "cust1", "SKU-A", 1, 1000, "idem-7")
        # Simulate a late gateway callback
        updated = saga.apply_gateway_event("t1", order.order_id, "payment_captured")

        assert updated.state == OrderState.CONFIRMED

    def test_payment_refunded_sets_refunded_state(self) -> None:
        saga = make_saga()
        order = saga.place_order("t1", "cust1", "SKU-A", 1, 1000, "idem-8")
        updated = saga.apply_gateway_event("t1", order.order_id, "payment_refunded")

        assert updated.state == OrderState.REFUNDED


class TestSupportLookup:
    def test_admin_can_find_order_across_tenants(self) -> None:
        saga = make_saga()
        order = saga.place_order("t1", "cust1", "SKU-A", 1, 1000, "idem-9")

        found = saga.store.lookup_for_support(order.order_id)
        assert found is not None
        assert found.order_id == order.order_id

    def test_admin_lookup_returns_none_for_unknown_order(self) -> None:
        saga = make_saga()
        assert saga.store.lookup_for_support("nonexistent") is None
