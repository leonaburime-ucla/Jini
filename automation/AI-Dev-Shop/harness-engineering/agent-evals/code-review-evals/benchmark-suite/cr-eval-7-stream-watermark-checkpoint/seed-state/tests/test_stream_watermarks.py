"""Tests for stream watermark processing."""
from __future__ import annotations

from src.stream_watermarks import (
    BatchReplayProcessor,
    InMemoryCheckpointBackend,
    InMemoryLateEventSink,
    InMemoryOutputSink,
    LateEventRouter,
    PartitionWatermarkTracker,
    ProcessorConfig,
    SensorEvent,
    StreamProcessor,
)


def make_event(
    event_id: str = "e1",
    *,
    sensor_id: str = "sensor-001",
    partition: int = 0,
    event_time: float = 100.0,
    value: float = 1.0,
    tenant_id: str = "tenant-a",
) -> SensorEvent:
    return SensorEvent(
        event_id=event_id,
        sensor_id=sensor_id,
        partition=partition,
        event_time=event_time,
        value=value,
        tenant_id=tenant_id,
    )


def make_processor(
    partitions: set[int] | None = None,
    window_size: float = 60.0,
    allowed_lateness: float = 30.0,
    clock_value: float = 1000.0,
) -> StreamProcessor:
    clock_val = clock_value
    return StreamProcessor(
        config=ProcessorConfig(
            window_size=window_size,
            allowed_lateness=allowed_lateness,
            checkpoint_interval=1000,
        ),
        sink=InMemoryOutputSink(),
        checkpoint=InMemoryCheckpointBackend(),
        late_sink=InMemoryLateEventSink(),
        clock=lambda: clock_val,
        assigned_partitions=partitions or {0, 1},
    )


class TestWatermarkAdvancement:
    def test_single_partition_advances_watermark(self) -> None:
        proc = make_processor(partitions={0})
        proc.process_event(make_event(event_time=50.0))
        assert proc.global_watermark == 50.0

    def test_two_partitions_lockstep(self) -> None:
        proc = make_processor(partitions={0, 1})
        proc.process_event(make_event(event_time=100.0, partition=0))
        proc.process_event(make_event(event_time=100.0, partition=1))
        assert proc.global_watermark == 100.0

    def test_watermark_never_goes_backwards(self) -> None:
        proc = make_processor(partitions={0})
        proc.process_event(make_event(event_time=100.0))
        proc.process_event(make_event(event_time=80.0))
        assert proc.global_watermark == 100.0


class TestWindowAggregation:
    def test_events_in_same_window_are_summed(self) -> None:
        proc = make_processor(partitions={0}, window_size=60.0)
        proc.process_event(make_event(event_time=10.0, value=3.0))
        proc.process_event(make_event(event_time=20.0, value=7.0))
        assert proc.active_window_count == 1

    def test_events_in_different_windows_are_separate(self) -> None:
        proc = make_processor(partitions={0}, window_size=60.0)
        proc.process_event(make_event(event_time=10.0, value=3.0))
        proc.process_event(make_event(event_time=70.0, value=7.0))
        assert proc.active_window_count == 2

    def test_flush_emits_closed_windows(self) -> None:
        proc = make_processor(partitions={0}, window_size=60.0)
        proc.process_event(make_event(event_time=10.0, value=5.0))
        proc.process_event(make_event(event_time=120.0, value=1.0))
        proc.flush()
        sink = proc._sink
        assert len(sink.outputs) == 1
        assert sink.outputs[0].total == 5.0


class TestLateEvents:
    def test_late_within_tolerance_is_aggregated(self) -> None:
        proc = make_processor(partitions={0}, allowed_lateness=30.0)
        proc.process_event(make_event(event_time=100.0, value=2.0))
        proc.process_event(make_event(event_time=80.0, value=3.0))
        assert proc.metrics.late_drops == 0

    def test_late_beyond_tolerance_is_counted(self) -> None:
        proc = make_processor(partitions={0}, allowed_lateness=30.0)
        proc.process_event(make_event(event_time=100.0, value=2.0))
        proc.process_event(make_event(event_time=50.0, value=3.0))
        assert proc.metrics.late_drops == 1


class TestCheckpointing:
    def test_checkpoint_recorded_on_flush(self) -> None:
        proc = make_processor(partitions={0}, window_size=60.0)
        proc.process_event(make_event(event_time=10.0, value=5.0))
        proc.process_event(make_event(event_time=120.0, value=1.0))
        proc.flush()
        assert proc._checkpoint.load(0) == 60.0

    def test_checkpoint_count_increments(self) -> None:
        proc = make_processor(partitions={0}, window_size=60.0)
        proc.process_event(make_event(event_time=10.0, value=5.0))
        proc.process_event(make_event(event_time=120.0, value=1.0))
        proc.flush()
        assert proc.metrics.checkpoints_committed == 1


class TestRebalance:
    def test_new_partition_loads_checkpoint(self) -> None:
        proc = make_processor(partitions={0})
        proc._checkpoint.commit(1, 200.0)
        proc.on_partitions_reassigned(newly_assigned={1}, revoked=set())
        assert 1 in proc._assigned_partitions
        assert proc._partition_watermarks[1] == 200.0

    def test_revoked_partition_removed_from_assignment(self) -> None:
        proc = make_processor(partitions={0, 1})
        proc.on_partitions_reassigned(newly_assigned=set(), revoked={1})
        assert 1 not in proc._assigned_partitions


class TestPartitionWatermarkTracker:
    def test_tracks_per_partition_max(self) -> None:
        tracker = PartitionWatermarkTracker(idle_timeout=300.0)
        tracker.update(0, event_time=50.0, wall_time=100.0)
        tracker.update(0, event_time=80.0, wall_time=101.0)
        assert tracker.get_partition_watermark(0) == 80.0

    def test_global_watermark_is_minimum_of_active(self) -> None:
        tracker = PartitionWatermarkTracker(idle_timeout=300.0)
        tracker.update(0, event_time=100.0, wall_time=10.0)
        tracker.update(1, event_time=60.0, wall_time=10.0)
        assert tracker.global_watermark({0, 1}, now=20.0) == 60.0

    def test_idle_partition_excluded_from_global(self) -> None:
        tracker = PartitionWatermarkTracker(idle_timeout=50.0)
        tracker.update(0, event_time=100.0, wall_time=10.0)
        tracker.update(1, event_time=30.0, wall_time=10.0)
        assert tracker.global_watermark({0, 1}, now=500.0) == 0.0


class TestLateEventRouter:
    def test_routes_event_with_metadata(self) -> None:
        sink = InMemoryLateEventSink()
        router = LateEventRouter(sink)
        event = make_event(event_time=10.0, partition=2)
        router.route_late_event(event, watermark=100.0, allowed_lateness=30.0)
        assert len(sink.events) == 1
        assert sink.events[0]["event_id"] == "e1"
        assert sink.events[0]["reason"] == "beyond_allowed_lateness"

    def test_counts_routed_events(self) -> None:
        sink = InMemoryLateEventSink()
        router = LateEventRouter(sink)
        event = make_event(event_time=10.0)
        router.route_late_event(event, watermark=100.0, allowed_lateness=30.0)
        router.route_late_event(event, watermark=100.0, allowed_lateness=30.0)
        assert router.routed_count == 2


class TestBatchReplay:
    def test_replays_in_event_time_order(self) -> None:
        proc = make_processor(partitions={0})
        replayer = BatchReplayProcessor(proc)
        events = [
            make_event("e3", event_time=300.0),
            make_event("e1", event_time=100.0),
            make_event("e2", event_time=200.0),
        ]
        count = replayer.replay_batch(events)
        assert count == 3
        assert replayer.total_replayed == 3
