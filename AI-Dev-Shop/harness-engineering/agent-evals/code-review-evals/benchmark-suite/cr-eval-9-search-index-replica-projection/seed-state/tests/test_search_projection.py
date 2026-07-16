"""Tests for the search index projection worker."""
from __future__ import annotations

from src.search_projection import (
    BackfillMapper,
    BatchEventProcessor,
    ConsistencyChecker,
    EventDeduplicator,
    FeatureFlagRouter,
    IndexSnapshotExporter,
    IndexedDocument,
    ProjectionEvent,
    ReplicationLagMonitor,
    SearchProjection,
    ShardRebalancer,
    ShardRouter,
    SourceRow,
    TenantShardValidator,
    VersionGatedWriter,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_event(
    document_id: str = "doc-1",
    *,
    tenant_id: str | None = "tenant-a",
    version: int = 1,
    op: str = "upsert",
    fields: dict[str, object] | None = None,
    generation: int = 0,
) -> ProjectionEvent:
    return ProjectionEvent(
        document_id=document_id,
        tenant_id=tenant_id,
        version=version,
        op=op,
        fields=fields or {"title": "Test", "body": "Content", "updated_at": 1},
        generation=generation,
    )


# ---------------------------------------------------------------------------
# Core projection tests
# ---------------------------------------------------------------------------


class TestSearchProjectionBasics:
    def test_apply_creates_document(self) -> None:
        proj = SearchProjection()
        proj.apply_event(make_event(version=1, fields={"title": "Hello"}))

        doc = proj.index["doc-1"]
        assert doc.version == 1
        assert doc.fields["title"] == "Hello"
        assert not doc.tombstoned

    def test_increasing_version_updates_document(self) -> None:
        proj = SearchProjection()
        proj.apply_event(make_event(version=1, fields={"title": "First"}))
        proj.apply_event(make_event(version=2, fields={"title": "Second"}))

        assert proj.index["doc-1"].version == 2
        assert proj.index["doc-1"].fields["title"] == "Second"

    def test_older_version_is_rejected(self) -> None:
        proj = SearchProjection()
        proj.apply_event(make_event(version=3, fields={"title": "Latest"}))
        proj.apply_event(make_event(version=1, fields={"title": "Stale"}))

        assert proj.index["doc-1"].fields["title"] == "Latest"
        assert proj.metrics.counters["rejected_version"] == 1

    def test_delete_creates_tombstone(self) -> None:
        proj = SearchProjection()
        proj.apply_event(make_event(version=1))
        proj.apply_event(make_event(version=2, op="delete", fields={}))

        assert proj.index["doc-1"].tombstoned
        assert proj.search("tenant-a") == []

    def test_search_filters_by_tenant(self) -> None:
        proj = SearchProjection()
        proj.apply_event(make_event("doc-a", tenant_id="tenant-a", version=1))
        proj.apply_event(make_event("doc-b", tenant_id="tenant-b", version=1))

        results = proj.search("tenant-a")
        assert len(results) == 1
        assert results[0].document_id == "doc-a"

    def test_search_with_query_filters_fields(self) -> None:
        proj = SearchProjection()
        proj.apply_event(
            make_event("doc-1", version=1, fields={"title": "Python Guide"})
        )
        proj.apply_event(
            make_event("doc-2", version=1, fields={"title": "Java Guide"})
        )

        results = proj.search("tenant-a", query="python")
        assert len(results) == 1
        assert results[0].document_id == "doc-1"

    def test_get_document_returns_none_for_tombstoned(self) -> None:
        proj = SearchProjection()
        proj.apply_event(make_event(version=1))
        proj.apply_event(make_event(version=2, op="delete", fields={}))

        assert proj.get_document("doc-1") is None

    def test_document_count(self) -> None:
        proj = SearchProjection()
        proj.apply_event(make_event("doc-1", tenant_id="tenant-a", version=1))
        proj.apply_event(make_event("doc-2", tenant_id="tenant-a", version=1))
        proj.apply_event(make_event("doc-3", tenant_id="tenant-b", version=1))

        assert proj.document_count() == 3
        assert proj.document_count("tenant-a") == 2


# ---------------------------------------------------------------------------
# Alias swap tests
# ---------------------------------------------------------------------------


class TestAliasManager:
    def test_swap_changes_current_alias(self) -> None:
        proj = SearchProjection()
        proj.lag_monitor.update("tenant-a:shard-0", 10)

        proj.alias_manager.swap_alias(
            "search-index-v2",
            target_version=10,
            expected_shards={"tenant-a:shard-0"},
        )

        assert proj.alias_manager.current_alias == "search-index-v2"

    def test_swap_increments_metrics(self) -> None:
        proj = SearchProjection()
        proj.alias_manager.swap_alias(
            "search-index-v2", target_version=5, expected_shards=set()
        )

        assert proj.metrics.counters["alias_swaps"] == 1


# ---------------------------------------------------------------------------
# Backfill tests
# ---------------------------------------------------------------------------


class TestBackfillMapper:
    def test_projects_known_fields(self) -> None:
        mapper = BackfillMapper()
        event = make_event(
            version=1,
            op="backfill",
            fields={"title": "BF", "body": "Content", "updated_at": 99, "status": "active"},
        )
        result = mapper.project(event)

        assert result == {
            "title": "BF",
            "body": "Content",
            "updated_at": 99,
            "status": "active",
        }

    def test_missing_optional_fields_skipped(self) -> None:
        mapper = BackfillMapper()
        event = make_event(version=1, op="backfill", fields={"title": "Only Title"})
        result = mapper.project(event)

        assert result == {"title": "Only Title"}

    def test_tracks_mapped_count(self) -> None:
        mapper = BackfillMapper()
        for i in range(5):
            mapper.project(make_event(version=i + 1, fields={"title": f"Doc {i}"}))

        assert mapper.stats["mapped"] == 5


# ---------------------------------------------------------------------------
# Shard routing tests
# ---------------------------------------------------------------------------


class TestShardRouter:
    def test_deterministic_routing(self) -> None:
        router = ShardRouter(shard_count=4)
        shard1 = router.route("tenant-a", "doc-1")
        shard2 = router.route("tenant-a", "doc-1")

        assert shard1 == shard2
        assert shard1.startswith("tenant-a:shard-")

    def test_different_documents_may_route_differently(self) -> None:
        router = ShardRouter(shard_count=8)
        shards = {router.route("tenant-a", f"doc-{i}") for i in range(100)}

        assert len(shards) > 1

    def test_all_shards_for_tenant(self) -> None:
        router = ShardRouter(shard_count=3)
        shards = router.all_shards_for_tenant("tenant-x")

        assert shards == {
            "tenant-x:shard-0",
            "tenant-x:shard-1",
            "tenant-x:shard-2",
        }


# ---------------------------------------------------------------------------
# Replication lag monitor tests
# ---------------------------------------------------------------------------


class TestReplicationLagMonitor:
    def test_update_tracks_version(self) -> None:
        monitor = ReplicationLagMonitor()
        monitor.update("tenant-a:shard-0", 5)
        monitor.update("tenant-a:shard-0", 10)

        assert monitor.shard_versions["tenant-a:shard-0"] == 10

    def test_does_not_regress_version(self) -> None:
        monitor = ReplicationLagMonitor()
        monitor.update("tenant-a:shard-0", 10)
        monitor.update("tenant-a:shard-0", 5)

        assert monitor.shard_versions["tenant-a:shard-0"] == 10

    def test_ready_for_cutover_all_caught_up(self) -> None:
        monitor = ReplicationLagMonitor()
        monitor.update("shard-0", 10)
        monitor.update("shard-1", 10)

        assert monitor.ready_for_cutover(10, {"shard-0", "shard-1"})

    def test_ready_for_cutover_one_behind(self) -> None:
        monitor = ReplicationLagMonitor()
        monitor.update("shard-0", 10)
        monitor.update("shard-1", 7)

        assert not monitor.ready_for_cutover(10, {"shard-0", "shard-1"})

    def test_ready_for_cutover_empty_shards_returns_false(self) -> None:
        monitor = ReplicationLagMonitor()
        assert not monitor.ready_for_cutover(10, set())


# ---------------------------------------------------------------------------
# VersionGatedWriter tests (NC-01)
# ---------------------------------------------------------------------------


class TestVersionGatedWriter:
    def test_accepts_newer_version(self) -> None:
        writer = VersionGatedWriter()
        assert writer.should_apply(1, 2) is True

    def test_skips_same_version(self) -> None:
        writer = VersionGatedWriter()
        assert writer.should_apply(2, 2) is False

    def test_skips_older_version(self) -> None:
        writer = VersionGatedWriter()
        assert writer.should_apply(5, 3) is False


# ---------------------------------------------------------------------------
# TenantShardValidator tests (NC-02)
# ---------------------------------------------------------------------------


class TestTenantShardValidator:
    def test_allows_assigned_shard(self) -> None:
        validator = TenantShardValidator(
            {"tenant-a": {"tenant-a:shard-0", "tenant-a:shard-1"}}
        )
        assert validator.allows("tenant-a", "tenant-a:shard-0")

    def test_rejects_unassigned_shard(self) -> None:
        validator = TenantShardValidator({"tenant-a": {"tenant-a:shard-0"}})
        assert not validator.allows("tenant-a", "tenant-a:shard-1")

    def test_rejects_unknown_tenant(self) -> None:
        validator = TenantShardValidator({"tenant-a": {"tenant-a:shard-0"}})
        assert not validator.allows("tenant-x", "tenant-x:shard-0")

    def test_provision_tenant(self) -> None:
        validator = TenantShardValidator({})
        validator.provision_tenant("tenant-b", {"tenant-b:shard-0"})
        assert validator.allows("tenant-b", "tenant-b:shard-0")


# ---------------------------------------------------------------------------
# Batch processor tests
# ---------------------------------------------------------------------------


class TestBatchEventProcessor:
    def test_processes_batch_in_version_order(self) -> None:
        proj = SearchProjection()
        processor = BatchEventProcessor(proj)

        events = [
            make_event("doc-1", version=3, fields={"title": "V3"}),
            make_event("doc-1", version=1, fields={"title": "V1"}),
            make_event("doc-1", version=2, fields={"title": "V2"}),
        ]
        result = processor.process_batch(events)

        assert proj.index["doc-1"].version == 3
        assert proj.index["doc-1"].fields["title"] == "V3"

    def test_counts_applied_events(self) -> None:
        proj = SearchProjection()
        processor = BatchEventProcessor(proj)

        events = [
            make_event("doc-1", version=1),
            make_event("doc-2", version=1),
        ]
        result = processor.process_batch(events)

        assert result["applied"] == 2
        assert result["total"] == 2


# ---------------------------------------------------------------------------
# Event deduplicator tests
# ---------------------------------------------------------------------------


class TestEventDeduplicator:
    def test_first_event_not_duplicate(self) -> None:
        dedup = EventDeduplicator()
        assert not dedup.is_duplicate("evt-1")

    def test_second_event_is_duplicate(self) -> None:
        dedup = EventDeduplicator()
        dedup.is_duplicate("evt-1")
        assert dedup.is_duplicate("evt-1")


# ---------------------------------------------------------------------------
# Feature flag router tests
# ---------------------------------------------------------------------------


class TestFeatureFlagRouter:
    def test_flag_disabled_uses_old_index(self) -> None:
        router = FeatureFlagRouter(flag_enabled=False)
        assert router.resolve_write_index("tenant-a") == "search-index-v1"
        assert router.resolve_read_index("tenant-a") == "search-index-v1"

    def test_flag_enabled_writes_to_new_index(self) -> None:
        router = FeatureFlagRouter(flag_enabled=True)
        assert router.resolve_write_index("tenant-a") == "search-index-v2"

    def test_flag_enabled_standard_reads_new_index(self) -> None:
        router = FeatureFlagRouter(flag_enabled=True)
        router.register_tenant_class("tenant-a", "standard")
        assert router.resolve_read_index("tenant-a") == "search-index-v2"


# ---------------------------------------------------------------------------
# Consistency checker tests
# ---------------------------------------------------------------------------


class TestConsistencyChecker:
    def test_matching_document_passes(self) -> None:
        index = {
            "doc-1": IndexedDocument(
                document_id="doc-1",
                tenant_id="t",
                version=5,
                fields={},
            )
        }
        checker = ConsistencyChecker(index)
        source = SourceRow("doc-1", "t", 5, {}, deleted=False)
        assert checker.check_document(source)

    def test_missing_document_fails(self) -> None:
        checker = ConsistencyChecker({})
        source = SourceRow("doc-1", "t", 5, {}, deleted=False)
        assert not checker.check_document(source)


# ---------------------------------------------------------------------------
# Shard rebalancer tests
# ---------------------------------------------------------------------------


class TestShardRebalancer:
    def test_no_change_produces_empty_plan(self) -> None:
        rebalancer = ShardRebalancer(
            {"tenant-a": {"tenant-a:shard-0", "tenant-a:shard-1"}}
        )
        plan = rebalancer.plan_rebalance(2)
        assert plan == []

    def test_adding_shard_produces_step(self) -> None:
        rebalancer = ShardRebalancer({"tenant-a": {"tenant-a:shard-0"}})
        plan = rebalancer.plan_rebalance(2)

        assert len(plan) == 1
        assert "tenant-a:shard-1" in plan[0]["add_shards"]


# ---------------------------------------------------------------------------
# Index snapshot exporter tests
# ---------------------------------------------------------------------------


class TestIndexSnapshotExporter:
    def test_export_tenant(self) -> None:
        index = {
            "doc-1": IndexedDocument("doc-1", "tenant-a", 3, {"title": "X"}),
            "doc-2": IndexedDocument("doc-2", "tenant-b", 1, {"title": "Y"}),
        }
        exporter = IndexSnapshotExporter(index)
        exported = exporter.export_tenant("tenant-a")

        assert len(exported) == 1
        assert exported[0]["document_id"] == "doc-1"

    def test_document_versions(self) -> None:
        index = {
            "doc-1": IndexedDocument("doc-1", "t", 5, {}),
            "doc-2": IndexedDocument("doc-2", "t", 8, {}),
        }
        exporter = IndexSnapshotExporter(index)
        versions = exporter.document_versions()

        assert versions == {"doc-1": 5, "doc-2": 8}
