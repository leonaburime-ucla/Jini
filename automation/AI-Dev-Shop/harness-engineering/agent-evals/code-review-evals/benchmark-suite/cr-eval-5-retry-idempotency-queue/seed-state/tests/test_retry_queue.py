"""Tests for the partner integration retry queue worker."""
from __future__ import annotations

from src.retry_queue import (
    BackpressureMonitor,
    DeliveryReceipt,
    IdempotencyStore,
    IdempotentReceiptCache,
    InMemoryDownstream,
    Message,
    PartitionConsumer,
    RetryPolicy,
    TransientPartnerError,
    create_consumer,
)


def _msg(
    msg_id: str = "m-1",
    tenant: str = "tenant-a",
    partition: int = 0,
    key: str | None = None,
) -> Message:
    return Message(
        message_id=msg_id,
        tenant_id=tenant,
        partition=partition,
        payload={"kind": "charge"},
        idempotency_key=key or f"{tenant}:{msg_id}",
    )


class TestSuccessfulDelivery:
    def test_happy_path_delivers_and_checkpoints(self) -> None:
        downstream = InMemoryDownstream()
        consumer = create_consumer(downstream, clock=lambda: 100.0)
        consumer.on_rebalance({0, 1})

        receipts = consumer.process_batch([_msg()], now=100.0)

        assert len(receipts) == 1
        assert receipts[0].status == "delivered"
        assert consumer.checkpoints[0] == "m-1"

    def test_duplicate_within_window_returns_cached_receipt(self) -> None:
        downstream = InMemoryDownstream()
        consumer = create_consumer(downstream, clock=lambda: 100.0)
        consumer.on_rebalance({0})

        first = consumer.process_batch([_msg()], now=100.0)
        second = consumer.process_batch([_msg()], now=200.0)

        assert first == second
        assert len(downstream.deliveries) == 1

    def test_unassigned_partition_skipped(self) -> None:
        downstream = InMemoryDownstream()
        consumer = create_consumer(downstream, clock=lambda: 100.0)
        consumer.on_rebalance({1})

        receipts = consumer.process_batch([_msg(partition=0)], now=100.0)

        assert receipts == []
        assert len(downstream.deliveries) == 0


class TestRetryScheduling:
    def test_transient_failure_schedules_retry(self) -> None:
        downstream = InMemoryDownstream()
        downstream.configure_transient_failure("m-1")
        consumer = create_consumer(
            downstream,
            max_attempts=3,
            base_delay=2.0,
            clock=lambda: 100.0,
        )
        consumer.on_rebalance({0})

        consumer.process_batch([_msg()], now=100.0)

        assert consumer.retry_depth == 1

    def test_max_attempts_sends_to_dlq(self) -> None:
        downstream = InMemoryDownstream()
        downstream.configure_transient_failure("m-1")
        consumer = create_consumer(downstream, max_attempts=2, clock=lambda: 100.0)
        consumer.on_rebalance({0})

        msg = Message(
            message_id="m-1",
            tenant_id="tenant-a",
            partition=0,
            payload={"kind": "charge"},
            idempotency_key="tenant-a:m-1",
            attempt_count=1,
        )
        consumer.process_batch([msg], now=100.0)

        assert consumer._dlq.messages[0][0].message_id == "m-1"

    def test_drain_retries_processes_due_entries(self) -> None:
        downstream = InMemoryDownstream()
        downstream.configure_transient_failure("m-1")
        consumer = create_consumer(
            downstream,
            max_attempts=5,
            base_delay=10.0,
            clock=lambda: 100.0,
        )
        consumer.on_rebalance({0})

        consumer.process_batch([_msg()], now=100.0)
        assert consumer.retry_depth == 1

        downstream._fail_transient.discard("m-1")
        receipts = consumer.drain_retries(now=200.0)

        assert len(receipts) == 1
        assert consumer.retry_depth == 0


class TestBackpressure:
    def test_backpressure_pauses_fetch(self) -> None:
        monitor = BackpressureMonitor(
            max_inflight=5,
            window_seconds=60.0,
            failure_threshold=0.5,
            clock=lambda: 100.0,
        )
        assert not monitor.should_pause_fetch(inflight=3)
        assert monitor.should_pause_fetch(inflight=5)

    def test_failure_ratio_triggers_pause(self) -> None:
        monitor = BackpressureMonitor(
            max_inflight=100,
            window_seconds=60.0,
            failure_threshold=0.5,
            clock=lambda: 100.0,
        )
        for _ in range(5):
            monitor.record_outcome(False, now=90.0)
        for _ in range(4):
            monitor.record_outcome(True, now=91.0)

        assert monitor.should_pause_fetch(inflight=1)


class TestIdempotentReceiptCache:
    def test_returns_cached_receipt_on_second_call(self) -> None:
        cache = IdempotentReceiptCache()
        calls = 0

        def factory() -> DeliveryReceipt:
            nonlocal calls
            calls += 1
            return DeliveryReceipt(
                receipt_id=f"r-{calls}",
                tenant_id="t",
                message_id="m",
                status="sent",
            )

        first = cache.get_or_create("key-1", factory)
        second = cache.get_or_create("key-1", factory)

        assert first == second
        assert calls == 1


class TestRebalance:
    def test_rebalance_updates_epoch_and_partitions(self) -> None:
        downstream = InMemoryDownstream()
        consumer = create_consumer(downstream, clock=lambda: 100.0)

        consumer.on_rebalance({0, 1, 2})
        assert consumer.epoch == 1
        assert consumer.assigned_partitions == frozenset({0, 1, 2})

        consumer.on_rebalance({1, 2})
        assert consumer.epoch == 2
        assert 0 not in consumer.assigned_partitions


class TestMetrics:
    def test_metrics_track_delivery_and_retry(self) -> None:
        downstream = InMemoryDownstream()
        consumer = create_consumer(downstream, clock=lambda: 100.0)
        consumer.on_rebalance({0})

        consumer.process_batch([_msg("m-ok")], now=100.0)

        downstream.configure_transient_failure("m-fail")
        consumer.process_batch([_msg("m-fail")], now=101.0)

        assert consumer.metrics.total_delivered == 1
        assert consumer.metrics.total_retried == 1
