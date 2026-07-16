"""
Stream processing worker for IoT sensor aggregation.

Consumes partitioned event streams, maintains per-partition watermarks,
aggregates into tumbling windows, checkpoints progress, and handles
late-arriving data from disconnected sensors.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable, Protocol


@dataclass(frozen=True)
class SensorEvent:
    event_id: str
    sensor_id: str
    partition: int
    event_time: float
    value: float
    tenant_id: str


@dataclass(frozen=True)
class WindowOutput:
    tenant_id: str
    partition: int
    window_start: float
    window_end: float
    count: int
    total: float
    min_value: float
    max_value: float


# ---------------------------------------------------------------------------
# Protocols
# ---------------------------------------------------------------------------


class OutputSink(Protocol):
    def emit(self, output: WindowOutput) -> None: ...


class CheckpointBackend(Protocol):
    def commit(self, partition: int, offset: float) -> None: ...
    def load(self, partition: int) -> float: ...


class LateEventSink(Protocol):
    def publish(self, event: SensorEvent, metadata: dict) -> None: ...


# ---------------------------------------------------------------------------
# In-memory implementations
# ---------------------------------------------------------------------------


class InMemoryOutputSink:
    def __init__(self) -> None:
        self.outputs: list[WindowOutput] = []

    def emit(self, output: WindowOutput) -> None:
        self.outputs.append(output)


class InMemoryCheckpointBackend:
    def __init__(self) -> None:
        self._positions: dict[int, float] = {}

    def commit(self, partition: int, offset: float) -> None:
        self._positions[partition] = offset

    def load(self, partition: int) -> float:
        return self._positions.get(partition, 0.0)


class InMemoryLateEventSink:
    def __init__(self) -> None:
        self.events: list[dict] = []

    def publish(self, event: SensorEvent, metadata: dict) -> None:
        self.events.append({
            "event_id": event.event_id,
            "sensor_id": event.sensor_id,
            "partition": event.partition,
            "event_time": event.event_time,
            "tenant_id": event.tenant_id,
            **metadata,
        })


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


class ProcessorMetrics:
    def __init__(self) -> None:
        self._events_processed: int = 0
        self._late_drops: int = 0
        self._windows_flushed: int = 0
        self._checkpoints_committed: int = 0
        self._rebalances: int = 0

    def record_event(self) -> None:
        self._events_processed += 1

    def record_late_drop(self) -> None:
        self._late_drops += 1

    def record_window_flush(self) -> None:
        self._windows_flushed += 1

    def record_checkpoint(self) -> None:
        self._checkpoints_committed += 1

    def record_rebalance(self) -> None:
        self._rebalances += 1

    @property
    def events_processed(self) -> int:
        return self._events_processed

    @property
    def late_drops(self) -> int:
        return self._late_drops

    @property
    def windows_flushed(self) -> int:
        return self._windows_flushed

    @property
    def checkpoints_committed(self) -> int:
        return self._checkpoints_committed


# ---------------------------------------------------------------------------
# Window accumulator
# ---------------------------------------------------------------------------


@dataclass
class WindowAccumulator:
    partition: int
    tenant_id: str
    window_start: float
    window_end: float
    count: int = 0
    total: float = 0.0
    min_value: float = float("inf")
    max_value: float = float("-inf")

    def add(self, value: float) -> None:
        self.count += 1
        self.total += value
        if value < self.min_value:
            self.min_value = value
        if value > self.max_value:
            self.max_value = value

    def to_output(self) -> WindowOutput:
        return WindowOutput(
            tenant_id=self.tenant_id,
            partition=self.partition,
            window_start=self.window_start,
            window_end=self.window_end,
            count=self.count,
            total=self.total,
            min_value=self.min_value,
            max_value=self.max_value,
        )


# ---------------------------------------------------------------------------
# Partition watermark tracker
# ---------------------------------------------------------------------------


class PartitionWatermarkTracker:
    """Tracks per-partition event-time watermarks for observability."""

    def __init__(self, idle_timeout: float = 300.0) -> None:
        self._idle_timeout = idle_timeout
        self._watermarks: dict[int, float] = {}
        self._last_activity: dict[int, float] = {}

    def update(self, partition: int, event_time: float, wall_time: float) -> None:
        current = self._watermarks.get(partition, 0.0)
        self._watermarks[partition] = max(current, event_time)
        self._last_activity[partition] = wall_time

    def global_watermark(self, assigned: set[int], now: float) -> float:
        active_watermarks = []
        for p in assigned:
            last = self._last_activity.get(p, 0.0)
            if now - last <= self._idle_timeout:
                active_watermarks.append(self._watermarks.get(p, 0.0))
        if not active_watermarks:
            return 0.0
        return min(active_watermarks)

    def get_partition_watermark(self, partition: int) -> float:
        return self._watermarks.get(partition, 0.0)

    def is_idle(self, partition: int, now: float) -> bool:
        last = self._last_activity.get(partition, 0.0)
        return now - last > self._idle_timeout


# ---------------------------------------------------------------------------
# Late event router
# ---------------------------------------------------------------------------


class LateEventRouter:
    """Routes events that arrive beyond the allowed lateness to the late sink."""

    def __init__(self, sink: LateEventSink) -> None:
        self._sink = sink
        self._routed_count: int = 0

    def route_late_event(
        self, event: SensorEvent, watermark: float, allowed_lateness: float
    ) -> None:
        metadata = {
            "watermark_at_arrival": watermark,
            "allowed_lateness": allowed_lateness,
            "lag_seconds": watermark - event.event_time,
            "reason": "beyond_allowed_lateness",
        }
        self._sink.publish(event, metadata)
        self._routed_count += 1

    @property
    def routed_count(self) -> int:
        return self._routed_count


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ProcessorConfig:
    window_size: float = 60.0
    allowed_lateness: float = 30.0
    idle_timeout: float = 300.0
    cleanup_grace: float = 600.0
    max_windows_per_partition: int = 1000
    checkpoint_interval: int = 100


# ---------------------------------------------------------------------------
# Stream processor
# ---------------------------------------------------------------------------


class StreamProcessor:
    """
    Processes partitioned sensor events into tumbling aggregation windows.

    Lifecycle:
        1. Receive event
        2. Update partition watermark
        3. Advance global watermark
        4. Assign event to window or handle as late
        5. Periodically flush closed windows and checkpoint
    """

    def __init__(
        self,
        *,
        config: ProcessorConfig | None = None,
        sink: OutputSink | None = None,
        checkpoint: CheckpointBackend | None = None,
        late_sink: LateEventSink | None = None,
        clock: Callable[[], float] | None = None,
        assigned_partitions: set[int] | None = None,
    ) -> None:
        self._config = config or ProcessorConfig()
        self._sink = sink or InMemoryOutputSink()
        self._checkpoint = checkpoint or InMemoryCheckpointBackend()
        self._late_sink = late_sink or InMemoryLateEventSink()
        self._clock = clock or time.time
        self._assigned_partitions: set[int] = set(assigned_partitions or set())
        self._partition_watermarks: dict[int, float] = {}
        self._global_watermark: float = 0.0
        self._windows: dict[tuple[int, float], WindowAccumulator] = {}
        self._metrics = ProcessorMetrics()
        self._events_since_checkpoint: int = 0
        self._late_router = LateEventRouter(self._late_sink)
        self._tracker = PartitionWatermarkTracker(
            idle_timeout=self._config.idle_timeout
        )

        for p in self._assigned_partitions:
            self._partition_watermarks[p] = self._checkpoint.load(p)

    # -------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------

    def process_event(self, event: SensorEvent) -> None:
        if event.partition not in self._assigned_partitions:
            return

        now = self._clock()
        self._metrics.record_event()

        self._update_partition_watermark(event.partition, event.event_time, now)
        self._advance_global_watermark()

        if event.event_time < self._global_watermark - self._config.allowed_lateness:
            self._metrics.record_late_drop()
            return

        if event.event_time < self._global_watermark:
            self._aggregate_late_within_tolerance(event)
        else:
            self._aggregate_event(event)

        self._events_since_checkpoint += 1
        if self._events_since_checkpoint >= self._config.checkpoint_interval:
            self._flush_closed_windows()
            self._events_since_checkpoint = 0

    def flush(self) -> None:
        self._flush_closed_windows()

    def on_partitions_reassigned(
        self, newly_assigned: set[int], revoked: set[int]
    ) -> None:
        self._metrics.record_rebalance()

        for partition in newly_assigned:
            watermark = self._checkpoint.load(partition)
            self._partition_watermarks[partition] = watermark
            self._assigned_partitions.add(partition)

        for partition in revoked:
            self._assigned_partitions.discard(partition)
            self._partition_watermarks.pop(partition, None)

    def trigger_idle_advance(self) -> None:
        now = self._clock()
        for partition in list(self._assigned_partitions):
            self._maybe_advance_idle(partition, now)
        self._advance_global_watermark()
        self._flush_closed_windows()

    @property
    def global_watermark(self) -> float:
        return self._global_watermark

    @property
    def metrics(self) -> ProcessorMetrics:
        return self._metrics

    @property
    def active_window_count(self) -> int:
        return len(self._windows)

    # -------------------------------------------------------------------
    # Watermark management
    # -------------------------------------------------------------------

    def _update_partition_watermark(
        self, partition: int, event_time: float, wall_time: float
    ) -> None:
        current = self._partition_watermarks.get(partition, 0.0)
        self._partition_watermarks[partition] = max(current, event_time)
        self._tracker.update(partition, event_time, wall_time)

    def _advance_global_watermark(self) -> None:
        active = [
            wm for p, wm in self._partition_watermarks.items()
            if p in self._assigned_partitions
        ]
        if not active:
            return
        self._global_watermark = max(active)

    def _maybe_advance_idle(self, partition: int, now: float) -> None:
        last_wm = self._partition_watermarks.get(partition, 0.0)
        if self._tracker.is_idle(partition, now):
            self._partition_watermarks[partition] = now

    # -------------------------------------------------------------------
    # Window assignment
    # -------------------------------------------------------------------

    def _assign_window(self, event: SensorEvent) -> tuple[int, float]:
        window_start = (
            int(event.event_time / self._config.window_size) * self._config.window_size
        )
        return event.partition, window_start

    def _aggregate_event(self, event: SensorEvent) -> None:
        partition, window_start = self._assign_window(event)
        window_end = window_start + self._config.window_size
        if not (window_start < event.event_time < window_end):
            return
        key = (partition, window_start)
        if key not in self._windows:
            self._windows[key] = WindowAccumulator(
                partition=partition,
                tenant_id=event.tenant_id,
                window_start=window_start,
                window_end=window_end,
            )
        self._windows[key].add(event.value)

    def _aggregate_late_within_tolerance(self, event: SensorEvent) -> None:
        partition, window_start = self._assign_window(event)
        window_end = window_start + self._config.window_size
        if not (window_start < event.event_time < window_end):
            return
        key = (partition, window_start)
        if key in self._windows:
            self._windows[key].add(event.value)
        else:
            self._windows[key] = WindowAccumulator(
                partition=partition,
                tenant_id=event.tenant_id,
                window_start=window_start,
                window_end=window_end,
            )
            self._windows[key].add(event.value)

    # -------------------------------------------------------------------
    # Flush and checkpoint
    # -------------------------------------------------------------------

    def _flush_closed_windows(self) -> None:
        closed_keys: list[tuple[int, float]] = []
        for key, acc in self._windows.items():
            partition, window_start = key
            window_end = window_start + self._config.window_size
            if window_end <= self._global_watermark:
                closed_keys.append(key)

        for key in closed_keys:
            acc = self._windows.pop(key)
            partition = acc.partition
            output = acc.to_output()

            self._checkpoint.commit(partition, acc.window_end)
            self._metrics.record_checkpoint()

            self._sink.emit(output)
            self._metrics.record_window_flush()

    # -------------------------------------------------------------------
    # Cleanup
    # -------------------------------------------------------------------

    def _cleanup_stale_windows(self) -> None:
        stale_keys: list[tuple[int, float]] = []
        for key, acc in self._windows.items():
            if (
                self._global_watermark - acc.window_end
                > self._config.cleanup_grace
            ):
                stale_keys.append(key)
        for key in stale_keys:
            del self._windows[key]


# ---------------------------------------------------------------------------
# Batch replay helper
# ---------------------------------------------------------------------------


class BatchReplayProcessor:
    """Replays historical events through the stream processor for backfill."""

    def __init__(self, processor: StreamProcessor) -> None:
        self._processor = processor
        self._replayed: int = 0

    def replay_batch(self, events: list[SensorEvent]) -> int:
        sorted_events = sorted(events, key=lambda e: e.event_time)
        for event in sorted_events:
            self._processor.process_event(event)
            self._replayed += 1
        self._processor.flush()
        return len(sorted_events)

    @property
    def total_replayed(self) -> int:
        return self._replayed


# ---------------------------------------------------------------------------
# Partition assignment strategy
# ---------------------------------------------------------------------------


class RoundRobinAssigner:
    """Assigns partitions to workers using round-robin strategy."""

    def __init__(self, total_partitions: int) -> None:
        self._total = total_partitions

    def assign(self, worker_id: int, total_workers: int) -> set[int]:
        partitions: set[int] = set()
        for p in range(self._total):
            if p % total_workers == worker_id:
                partitions.add(p)
        return partitions

    def rebalance(
        self,
        worker_id: int,
        total_workers: int,
        previous: set[int],
    ) -> tuple[set[int], set[int]]:
        new_assignment = self.assign(worker_id, total_workers)
        newly_assigned = new_assignment - previous
        revoked = previous - new_assignment
        return newly_assigned, revoked


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


class ProcessorHealthCheck:
    """Reports health status based on processing lag and state size."""

    def __init__(
        self,
        processor: StreamProcessor,
        max_lag_seconds: float = 120.0,
        max_windows: int = 5000,
    ) -> None:
        self._processor = processor
        self._max_lag = max_lag_seconds
        self._max_windows = max_windows

    def is_healthy(self) -> bool:
        if self._processor.active_window_count > self._max_windows:
            return False
        return True

    def lag_seconds(self, wall_time: float) -> float:
        wm = self._processor.global_watermark
        if wm == 0.0:
            return 0.0
        return wall_time - wm

    def status(self, wall_time: float) -> dict:
        return {
            "healthy": self.is_healthy(),
            "lag_seconds": self.lag_seconds(wall_time),
            "active_windows": self._processor.active_window_count,
            "events_processed": self._processor.metrics.events_processed,
            "late_drops": self._processor.metrics.late_drops,
            "windows_flushed": self._processor.metrics.windows_flushed,
        }


# ---------------------------------------------------------------------------
# Windowed aggregation pipeline (high-level orchestrator)
# ---------------------------------------------------------------------------


class AggregationPipeline:
    """
    Orchestrates the full lifecycle: assignment, processing, rebalance,
    health monitoring.
    """

    def __init__(
        self,
        *,
        worker_id: int,
        total_workers: int,
        total_partitions: int = 32,
        config: ProcessorConfig | None = None,
        sink: OutputSink | None = None,
        checkpoint: CheckpointBackend | None = None,
        late_sink: LateEventSink | None = None,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self._worker_id = worker_id
        self._total_workers = total_workers
        self._assigner = RoundRobinAssigner(total_partitions)
        self._config = config or ProcessorConfig()
        self._clock = clock or time.time

        initial = self._assigner.assign(worker_id, total_workers)
        self._processor = StreamProcessor(
            config=self._config,
            sink=sink,
            checkpoint=checkpoint,
            late_sink=late_sink,
            clock=self._clock,
            assigned_partitions=initial,
        )
        self._health = ProcessorHealthCheck(self._processor)
        self._current_partitions = initial

    def ingest(self, event: SensorEvent) -> None:
        self._processor.process_event(event)

    def handle_rebalance(self, new_total_workers: int) -> None:
        newly_assigned, revoked = self._assigner.rebalance(
            self._worker_id, new_total_workers, self._current_partitions
        )
        self._processor.on_partitions_reassigned(newly_assigned, revoked)
        self._current_partitions = (
            self._current_partitions | newly_assigned
        ) - revoked
        self._total_workers = new_total_workers

    def tick(self) -> None:
        self._processor.trigger_idle_advance()

    def health_status(self) -> dict:
        return self._health.status(self._clock())

    @property
    def processor(self) -> StreamProcessor:
        return self._processor


# ---------------------------------------------------------------------------
# Event deserializer
# ---------------------------------------------------------------------------


class EventDeserializer:
    """Parses raw message bytes into SensorEvent instances."""

    def __init__(self, encoding: str = "utf-8") -> None:
        self._encoding = encoding
        self._errors: int = 0

    def deserialize(self, partition: int, raw: bytes) -> SensorEvent | None:
        try:
            text = raw.decode(self._encoding)
            parts = text.split("|")
            if len(parts) != 5:
                self._errors += 1
                return None
            return SensorEvent(
                event_id=parts[0],
                sensor_id=parts[1],
                partition=partition,
                event_time=float(parts[2]),
                value=float(parts[3]),
                tenant_id=parts[4],
            )
        except (ValueError, UnicodeDecodeError):
            self._errors += 1
            return None

    @property
    def error_count(self) -> int:
        return self._errors


# ---------------------------------------------------------------------------
# Watermark lag monitor
# ---------------------------------------------------------------------------


class WatermarkLagMonitor:
    """Tracks per-partition lag for alerting."""

    def __init__(self, alert_threshold: float = 60.0) -> None:
        self._threshold = alert_threshold
        self._alerts: list[dict] = []

    def check(self, partition_watermarks: dict[int, float], wall_time: float) -> None:
        for partition, wm in partition_watermarks.items():
            lag = wall_time - wm
            if lag > self._threshold:
                self._alerts.append({
                    "partition": partition,
                    "lag_seconds": lag,
                    "watermark": wm,
                    "wall_time": wall_time,
                })

    @property
    def alerts(self) -> list[dict]:
        return list(self._alerts)

    def clear_alerts(self) -> None:
        self._alerts.clear()




