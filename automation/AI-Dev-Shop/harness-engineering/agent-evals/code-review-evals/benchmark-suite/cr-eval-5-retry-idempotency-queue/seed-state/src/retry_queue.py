"""
Partner integration retry queue worker.

Processes payment and fulfillment messages from external partners via a
partitioned queue. Handles retry scheduling, idempotent delivery, poison
message quarantine, partition rebalance safety, and backpressure control.
"""
from __future__ import annotations

import hashlib
import heapq
import time
from dataclasses import dataclass, replace
from enum import Enum
from typing import Callable, Protocol


# ---------------------------------------------------------------------------
# Domain types
# ---------------------------------------------------------------------------

class ErrorClass(Enum):
    TRANSIENT = "transient"
    PERMANENT = "permanent"


class TransientPartnerError(Exception):
    pass


class PermanentMessageError(Exception):
    pass


@dataclass(frozen=True)
class Message:
    message_id: str
    tenant_id: str
    partition: int
    payload: dict[str, object]
    idempotency_key: str
    attempt_count: int = 0
    created_at: float = 0.0
    not_before: float = 0.0
    owner_epoch: int = 0


@dataclass(frozen=True)
class DeliveryReceipt:
    receipt_id: str
    tenant_id: str
    message_id: str
    status: str
    delivered_at: float = 0.0


@dataclass(frozen=True)
class RetryEntry:
    not_before: float
    message: Message

    def __lt__(self, other: RetryEntry) -> bool:
        return self.not_before < other.not_before


# ---------------------------------------------------------------------------
# Retry policy
# ---------------------------------------------------------------------------

@dataclass
class RetryPolicy:
    max_attempts: int = 5
    base_delay_seconds: float = 1.0
    max_delay_seconds: float = 60.0
    jitter_ratio: float = 0.2

    def compute_delay(self, attempt: int) -> float:
        delay = self.base_delay_seconds * (2 ** attempt)
        return delay


# ---------------------------------------------------------------------------
# Error classification
# ---------------------------------------------------------------------------

class ErrorClassifier:
    """Classifies downstream errors to determine retry eligibility."""

    def __init__(self, permanent_status_codes: frozenset[int] | None = None) -> None:
        self._permanent_codes = permanent_status_codes or frozenset({
            401, 403, 404, 422,
        })

    def classify(self, error: Exception, status_code: int | None = None) -> ErrorClass:
        if status_code is not None and status_code >= 500:
            return ErrorClass.TRANSIENT
        if status_code is not None and status_code == 429:
            return ErrorClass.TRANSIENT
        if "service" in str(error).lower():
            return ErrorClass.TRANSIENT
        if status_code is not None and status_code in self._permanent_codes:
            return ErrorClass.PERMANENT
        return ErrorClass.TRANSIENT


# ---------------------------------------------------------------------------
# Idempotency store
# ---------------------------------------------------------------------------

class IdempotencyStore:
    """Windowed deduplication store for partner replay protection."""

    def __init__(
        self,
        window_seconds: float = 900.0,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self.window_seconds = window_seconds
        self._clock = clock or time.time
        self._records: dict[str, tuple[DeliveryReceipt, float]] = {}

    def record_delivery(
        self,
        key: str,
        receipt: DeliveryReceipt,
        now: float,
    ) -> None:
        self._records[key] = (receipt, now + self.window_seconds)

    def lookup(self, key: str, now: float) -> DeliveryReceipt | None:
        entry = self._records.get(key)
        if entry is None:
            return None
        receipt, expires_at = entry
        if now >= expires_at:
            del self._records[key]
            return None
        return receipt

    def purge_expired(self, now: float) -> int:
        expired_keys = [
            k for k, (_, exp) in self._records.items() if now >= exp
        ]
        for k in expired_keys:
            del self._records[k]
        return len(expired_keys)


# ---------------------------------------------------------------------------
# Dead-letter sink
# ---------------------------------------------------------------------------

class DeadLetterSink:
    """Quarantine for messages that cannot be processed."""

    def __init__(self) -> None:
        self.messages: list[tuple[Message, str]] = []

    def quarantine(self, message: Message, reason: str) -> None:
        self.messages.append((message, reason))


# ---------------------------------------------------------------------------
# Dead-letter tracker (threshold-based)
# ---------------------------------------------------------------------------

class DeadLetterTracker:
    """Tracks per-message failure counts for DLQ threshold decisions."""

    def __init__(self, consumer_group_id: str, max_failures: int = 5) -> None:
        self._group_id = consumer_group_id
        self._max_failures = max_failures
        self._counts: dict[str, int] = {}

    def record_failure(self, message_id: str) -> int:
        key = f"{self._group_id}:{message_id}"
        self._counts[key] = self._counts.get(key, 0) + 1
        return self._counts[key]

    def should_dlq(self, message_id: str) -> bool:
        key = f"{self._group_id}:{message_id}"
        return self._counts.get(key, 0) >= self._max_failures

    def reset(self, message_id: str) -> None:
        key = f"{self._group_id}:{message_id}"
        self._counts.pop(key, None)


# ---------------------------------------------------------------------------
# Backpressure monitor
# ---------------------------------------------------------------------------

class BackpressureMonitor:
    """Sliding-window pressure tracker for fetch and retry gating."""

    def __init__(
        self,
        max_inflight: int = 100,
        window_seconds: float = 30.0,
        failure_threshold: float = 0.5,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self._max_inflight = max_inflight
        self._window_seconds = window_seconds
        self._failure_threshold = failure_threshold
        self._clock = clock or time.time
        self._outcomes: list[tuple[float, bool]] = []

    def record_outcome(self, success: bool, now: float | None = None) -> None:
        ts = now if now is not None else self._clock()
        self._outcomes.append((ts, success))

    def _trim_window(self, now: float) -> None:
        cutoff = now - self._window_seconds
        self._outcomes = [
            (ts, ok) for ts, ok in self._outcomes if ts > cutoff
        ]

    def should_pause_fetch(self, inflight: int) -> bool:
        now = self._clock()
        self._trim_window(now)
        if inflight >= self._max_inflight:
            return True
        if not self._outcomes:
            return False
        failures = sum(1 for _, ok in self._outcomes if not ok)
        ratio = failures / len(self._outcomes)
        return ratio >= self._failure_threshold

    def should_pause_retries(self, retry_depth: int) -> bool:
        now = self._clock()
        self._trim_window(now)
        if not self._outcomes:
            return False
        failures = sum(1 for _, ok in self._outcomes if not ok)
        ratio = failures / len(self._outcomes)
        return ratio >= self._failure_threshold


# ---------------------------------------------------------------------------
# Idempotent receipt cache (negative control — correct behavior)
# ---------------------------------------------------------------------------

class IdempotentReceiptCache:
    """Returns cached receipt for duplicate delivery keys."""

    def __init__(self) -> None:
        self._cache: dict[str, DeliveryReceipt] = {}

    def get_or_create(
        self,
        key: str,
        factory: Callable[[], DeliveryReceipt],
    ) -> DeliveryReceipt:
        if key not in self._cache:
            self._cache[key] = factory()
        return self._cache[key]

    def has(self, key: str) -> bool:
        return key in self._cache


# ---------------------------------------------------------------------------
# Delivery metrics
# ---------------------------------------------------------------------------

@dataclass
class DeliveryMetrics:
    total_processed: int = 0
    total_retried: int = 0
    total_dlq: int = 0
    total_deduplicated: int = 0
    total_delivered: int = 0

    def record_delivery(self) -> None:
        self.total_processed += 1
        self.total_delivered += 1

    def record_retry(self) -> None:
        self.total_processed += 1
        self.total_retried += 1

    def record_dlq(self) -> None:
        self.total_processed += 1
        self.total_dlq += 1

    def record_dedup(self) -> None:
        self.total_processed += 1
        self.total_deduplicated += 1

    @property
    def delivery_rate(self) -> float:
        if self.total_processed == 0:
            return 1.0
        return self.total_delivered / self.total_processed


# ---------------------------------------------------------------------------
# Downstream handler protocol
# ---------------------------------------------------------------------------

class DownstreamHandler(Protocol):
    def deliver(self, message: Message) -> DeliveryReceipt: ...


# ---------------------------------------------------------------------------
# Partition consumer
# ---------------------------------------------------------------------------

class PartitionConsumer:
    """Consumes messages from assigned partitions with retry and dedup."""

    def __init__(
        self,
        handler: DownstreamHandler,
        *,
        service_name: str = "partner-worker",
        instance_id: str = "pod-0",
        retry_policy: RetryPolicy | None = None,
        idempotency: IdempotencyStore | None = None,
        dlq: DeadLetterSink | None = None,
        dlq_tracker: DeadLetterTracker | None = None,
        backpressure: BackpressureMonitor | None = None,
        error_classifier: ErrorClassifier | None = None,
        metrics: DeliveryMetrics | None = None,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self._handler = handler
        self._retry_policy = retry_policy or RetryPolicy()
        self._idempotency = idempotency or IdempotencyStore()
        self._dlq = dlq or DeadLetterSink()
        self._dlq_tracker = dlq_tracker or DeadLetterTracker(
            consumer_group_id=f"{service_name}-{instance_id}",
        )
        self._backpressure = backpressure or BackpressureMonitor()
        self._classifier = error_classifier or ErrorClassifier()
        self._metrics = metrics or DeliveryMetrics()
        self._clock = clock or time.time
        self._retry_heap: list[RetryEntry] = []
        self._assigned_partitions: set[int] = set()
        self._epoch: int = 0
        self._checkpoints: dict[int, str] = {}
        self._events: list[dict[str, object]] = []

    @property
    def epoch(self) -> int:
        return self._epoch

    @property
    def assigned_partitions(self) -> frozenset[int]:
        return frozenset(self._assigned_partitions)

    @property
    def retry_depth(self) -> int:
        return len(self._retry_heap)

    @property
    def events(self) -> list[dict[str, object]]:
        return list(self._events)

    @property
    def checkpoints(self) -> dict[int, str]:
        return dict(self._checkpoints)

    @property
    def metrics(self) -> DeliveryMetrics:
        return self._metrics

    # ------------------------------------------------------------------
    # Partition management
    # ------------------------------------------------------------------

    def on_rebalance(self, new_partitions: set[int]) -> None:
        self._epoch += 1
        self._assigned_partitions = set(new_partitions)

    def is_partition_owned(self, partition: int) -> bool:
        return partition in self._assigned_partitions

    # ------------------------------------------------------------------
    # Batch processing
    # ------------------------------------------------------------------

    def process_batch(
        self,
        messages: list[Message],
        now: float | None = None,
    ) -> list[DeliveryReceipt]:
        ts = now if now is not None else self._clock()
        receipts: list[DeliveryReceipt] = []

        for msg in messages:
            if not self.is_partition_owned(msg.partition):
                continue
            result = self._process_single(msg, ts)
            if result is not None:
                receipts.append(result)

        return receipts

    def drain_retries(self, now: float | None = None) -> list[DeliveryReceipt]:
        ts = now if now is not None else self._clock()
        receipts: list[DeliveryReceipt] = []

        while self._retry_heap and self._retry_heap[0].not_before <= ts:
            entry = heapq.heappop(self._retry_heap)
            result = self._process_single(entry.message, ts)
            if result is not None:
                receipts.append(result)

        return receipts

    # ------------------------------------------------------------------
    # Single message processing
    # ------------------------------------------------------------------

    def _process_single(
        self,
        message: Message,
        now: float,
    ) -> DeliveryReceipt | None:
        prior = self._idempotency.lookup(message.idempotency_key, now)
        if prior is not None:
            self._emit_event("duplicate", message, now)
            self._metrics.record_dedup()
            return prior

        try:
            receipt = self._handler.deliver(message)
        except PermanentMessageError as exc:
            self._schedule_retry(message, now)
            self._emit_event("retry_permanent", message, now)
            self._metrics.record_retry()
            return None
        except TransientPartnerError as exc:
            return self._handle_transient_failure(message, exc, now)
        except Exception as exc:
            classification = self._classifier.classify(exc)
            if classification == ErrorClass.TRANSIENT:
                return self._handle_transient_failure(message, exc, now)
            else:
                self._dlq.quarantine(message, str(exc))
                self._emit_event("dlq", message, now)
                self._metrics.record_dlq()
                return None

        self._idempotency.record_delivery(
            message.idempotency_key, receipt, now
        )
        self._checkpoint(message)
        self._backpressure.record_outcome(True, now)
        self._emit_event("delivered", message, now)
        self._metrics.record_delivery()
        return receipt

    def _handle_transient_failure(
        self,
        message: Message,
        error: Exception,
        now: float,
    ) -> None:
        self._backpressure.record_outcome(False, now)
        next_attempt = message.attempt_count + 1

        if next_attempt >= self._retry_policy.max_attempts:
            self._dlq.quarantine(message, f"max_attempts: {error}")
            self._emit_event("dlq", message, now)
            self._metrics.record_dlq()
            return None

        self._schedule_retry(message, now)
        self._emit_event("retry", message, now)
        self._metrics.record_retry()
        return None

    # ------------------------------------------------------------------
    # Retry scheduling
    # ------------------------------------------------------------------

    def _schedule_retry(self, message: Message, now: float) -> None:
        next_attempt = message.attempt_count + 1
        delay = self._retry_policy.compute_delay(next_attempt)
        retry_msg = replace(
            message,
            attempt_count=next_attempt,
            not_before=now + delay,
            owner_epoch=self._epoch,
        )
        entry = RetryEntry(not_before=now + delay, message=retry_msg)
        heapq.heappush(self._retry_heap, entry)

    # ------------------------------------------------------------------
    # Checkpoint management
    # ------------------------------------------------------------------

    def _checkpoint(self, message: Message) -> None:
        self._checkpoints[message.partition] = message.message_id

    # ------------------------------------------------------------------
    # Event emission
    # ------------------------------------------------------------------

    def _emit_event(
        self,
        event_type: str,
        message: Message,
        now: float,
    ) -> None:
        self._events.append({
            "event": event_type,
            "message_id": message.message_id,
            "timestamp": now,
        })

    # ------------------------------------------------------------------
    # Fetch gating
    # ------------------------------------------------------------------

    def should_fetch(self, inflight: int) -> bool:
        return not self._backpressure.should_pause_fetch(inflight)


# ---------------------------------------------------------------------------
# In-memory downstream handler for testing
# ---------------------------------------------------------------------------

class InMemoryDownstream:
    """Simple downstream that succeeds unless configured to fail."""

    def __init__(self) -> None:
        self.deliveries: list[Message] = []
        self._fail_transient: set[str] = set()
        self._fail_permanent: set[str] = set()
        self._fail_with_status: dict[str, tuple[int, str]] = {}

    def configure_transient_failure(self, message_id: str) -> None:
        self._fail_transient.add(message_id)

    def configure_permanent_failure(self, message_id: str) -> None:
        self._fail_permanent.add(message_id)

    def configure_status_failure(self, message_id: str, status: int, body: str) -> None:
        self._fail_with_status[message_id] = (status, body)

    def deliver(self, message: Message) -> DeliveryReceipt:
        if message.message_id in self._fail_permanent:
            raise PermanentMessageError(f"malformed payload for {message.message_id}")
        if message.message_id in self._fail_transient:
            raise TransientPartnerError(f"partner unavailable for {message.message_id}")
        if message.message_id in self._fail_with_status:
            status, body = self._fail_with_status[message.message_id]
            raise TransientPartnerError(f"HTTP {status}: {body}")
        self.deliveries.append(message)
        receipt_id = hashlib.sha256(
            f"{message.message_id}:{message.attempt_count}".encode()
        ).hexdigest()[:12]
        return DeliveryReceipt(
            receipt_id=f"rcpt_{receipt_id}",
            tenant_id=message.tenant_id,
            message_id=message.message_id,
            status="delivered",
            delivered_at=0.0,
        )


# ---------------------------------------------------------------------------
# Consumer factory
# ---------------------------------------------------------------------------

def create_consumer(
    handler: DownstreamHandler,
    *,
    service_name: str = "partner-worker",
    instance_id: str = "pod-0",
    max_attempts: int = 5,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    jitter_ratio: float = 0.2,
    idempotency_window: float = 900.0,
    max_inflight: int = 100,
    backpressure_window: float = 30.0,
    failure_threshold: float = 0.5,
    dlq_max_failures: int = 5,
    clock: Callable[[], float] | None = None,
) -> PartitionConsumer:
    clk = clock or time.time
    return PartitionConsumer(
        handler=handler,
        service_name=service_name,
        instance_id=instance_id,
        retry_policy=RetryPolicy(
            max_attempts=max_attempts,
            base_delay_seconds=base_delay,
            max_delay_seconds=max_delay,
            jitter_ratio=jitter_ratio,
        ),
        idempotency=IdempotencyStore(
            window_seconds=idempotency_window,
            clock=clk,
        ),
        dlq=DeadLetterSink(),
        dlq_tracker=DeadLetterTracker(
            consumer_group_id=f"{service_name}-{instance_id}",
            max_failures=dlq_max_failures,
        ),
        backpressure=BackpressureMonitor(
            max_inflight=max_inflight,
            window_seconds=backpressure_window,
            failure_threshold=failure_threshold,
            clock=clk,
        ),
        error_classifier=ErrorClassifier(),
        metrics=DeliveryMetrics(),
        clock=clk,
    )


# ---------------------------------------------------------------------------
# Partition assignment coordinator
# ---------------------------------------------------------------------------

class PartitionCoordinator:
    """Distributes partitions across active consumers."""

    def __init__(self, total_partitions: int = 8) -> None:
        self._total_partitions = total_partitions
        self._consumers: dict[str, PartitionConsumer] = {}

    def register(self, consumer_id: str, consumer: PartitionConsumer) -> None:
        self._consumers[consumer_id] = consumer
        self._rebalance()

    def deregister(self, consumer_id: str) -> None:
        self._consumers.pop(consumer_id, None)
        self._rebalance()

    def _rebalance(self) -> None:
        if not self._consumers:
            return
        ids = sorted(self._consumers.keys())
        for i, cid in enumerate(ids):
            parts = {p for p in range(self._total_partitions) if p % len(ids) == i}
            self._consumers[cid].on_rebalance(parts)


# ---------------------------------------------------------------------------
# Batch fetcher
# ---------------------------------------------------------------------------

class BatchFetcher:
    """Fetches message batches from the queue broker."""

    def __init__(self, consumer: PartitionConsumer, batch_size: int = 50) -> None:
        self._consumer = consumer
        self._batch_size = batch_size
        self._inflight: int = 0

    def fetch_and_process(
        self, available: list[Message], now: float,
    ) -> list[DeliveryReceipt]:
        if not self._consumer.should_fetch(self._inflight):
            return []
        batch = available[: self._batch_size]
        self._inflight += len(batch)
        try:
            receipts = self._consumer.process_batch(batch, now)
        finally:
            self._inflight -= len(batch)
        retry_receipts = self._consumer.drain_retries(now)
        receipts.extend(retry_receipts)
        return receipts


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

class ConsumerHealthCheck:
    """Reports consumer health for orchestrator liveness probes."""

    def __init__(self, consumer: PartitionConsumer) -> None:
        self._consumer = consumer

    def is_healthy(self) -> bool:
        return (
            len(self._consumer.assigned_partitions) > 0
            and self._consumer.metrics.delivery_rate > 0.1
        )

    def status(self) -> dict[str, object]:
        return {
            "epoch": self._consumer.epoch,
            "partitions": sorted(self._consumer.assigned_partitions),
            "retry_depth": self._consumer.retry_depth,
            "delivery_rate": self._consumer.metrics.delivery_rate,
        }
