"""
Search index projection for tenant-scoped replica rollout.

Consumes domain events from Kafka, maintains versioned documents in a
sharded search index, supports periodic backfill reconciliation, alias
cutover for zero-downtime migration, and feature-flag-gated rollout.
"""
from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Protocol

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Domain models
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ProjectionEvent:
    document_id: str
    tenant_id: str | None
    version: int
    op: str
    fields: dict[str, object]
    generation: int = 0


@dataclass
class IndexedDocument:
    document_id: str
    tenant_id: str
    version: int
    fields: dict[str, object]
    tombstoned: bool = False
    tombstone_version: int = 0
    generation: int = 0
    indexed_at: float = field(default_factory=time.time)


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


class ReplicationMetrics:
    def __init__(self) -> None:
        self.counters: dict[str, int] = {
            "applied": 0,
            "rejected_version": 0,
            "rejected_tenant": 0,
            "tombstones": 0,
            "resurrections_blocked": 0,
            "alias_swaps": 0,
            "backfill_applied": 0,
            "reindex_pages": 0,
        }
        self._lag_high_water: dict[str, int] = {}

    def applied(self, tenant_id: str, shard: str, version: int) -> None:
        self.counters["applied"] += 1
        self._lag_high_water[f"{tenant_id}:{shard}"] = max(
            self._lag_high_water.get(f"{tenant_id}:{shard}", 0), version
        )

    def rejected_version(self) -> None:
        self.counters["rejected_version"] += 1

    def rejected_tenant(self) -> None:
        self.counters["rejected_tenant"] += 1

    def tombstone(self) -> None:
        self.counters["tombstones"] += 1

    def resurrection_blocked(self) -> None:
        self.counters["resurrections_blocked"] += 1

    def alias_swap(self) -> None:
        self.counters["alias_swaps"] += 1

    def backfill_applied(self) -> None:
        self.counters["backfill_applied"] += 1

    def reindex_page(self) -> None:
        self.counters["reindex_pages"] += 1

    def get_lag(self, tenant_id: str, shard: str) -> int:
        return self._lag_high_water.get(f"{tenant_id}:{shard}", 0)


# ---------------------------------------------------------------------------
# Shard routing
# ---------------------------------------------------------------------------


class ShardRouter:
    def __init__(self, shard_count: int) -> None:
        self.shard_count = shard_count

    def route(self, tenant_id: str | None, document_id: str) -> str:
        tenant = tenant_id or "default"
        digest = hashlib.md5(
            f"{tenant}:{document_id}".encode(), usedforsecurity=False
        ).hexdigest()
        slot = int(digest[:8], 16) % self.shard_count
        return f"{tenant}:shard-{slot}"

    def all_shards_for_tenant(self, tenant_id: str) -> set[str]:
        return {f"{tenant_id}:shard-{i}" for i in range(self.shard_count)}


# ---------------------------------------------------------------------------
# Replication lag monitor
# ---------------------------------------------------------------------------


class ReplicationLagMonitor:
    def __init__(self) -> None:
        self.shard_versions: dict[str, int] = {}
        self._last_update: dict[str, float] = {}

    def update(self, shard: str, version: int) -> None:
        current = self.shard_versions.get(shard, 0)
        if version > current:
            self.shard_versions[shard] = version
            self._last_update[shard] = time.time()

    def ready_for_cutover(
        self, target_version: int, expected_shards: set[str]
    ) -> bool:
        if not expected_shards:
            return False
        return all(
            self.shard_versions.get(shard, 0) >= target_version
            for shard in expected_shards
        )

    def lag_seconds(self, shard: str) -> float:
        last = self._last_update.get(shard)
        if last is None:
            return float("inf")
        return time.time() - last


# ---------------------------------------------------------------------------
# Alias management
# ---------------------------------------------------------------------------


class AliasManager:
    def __init__(
        self, lag_monitor: ReplicationLagMonitor, metrics: ReplicationMetrics
    ) -> None:
        self.current_alias: str = "search-index-v1"
        self.lag_monitor = lag_monitor
        self.metrics = metrics
        self._swap_history: list[dict[str, Any]] = []

    def swap_alias(
        self,
        next_alias: str,
        target_version: int,
        expected_shards: set[str],
    ) -> None:
        logger.info(
            "Swapping alias %s -> %s (target=%d, shards=%d)",
            self.current_alias,
            next_alias,
            target_version,
            len(expected_shards),
        )
        self._swap_history.append(
            {
                "from": self.current_alias,
                "to": next_alias,
                "target_version": target_version,
            }
        )
        self.current_alias = next_alias
        self.metrics.alias_swap()

    @property
    def history(self) -> list[dict[str, Any]]:
        return list(self._swap_history)


# ---------------------------------------------------------------------------
# Version gating (NC-01: correct strict-greater-than implementation)
# ---------------------------------------------------------------------------


class VersionGatedWriter:
    """Strict-greater-than semantics for version deduplication.

    Same-version events are replays and must be skipped. The event stream
    guarantees monotonic versions per aggregate.
    """

    def should_apply(self, current_version: int, incoming_version: int) -> bool:
        return incoming_version > current_version


# ---------------------------------------------------------------------------
# Tenant shard validation (NC-02: correct isolation enforcement)
# ---------------------------------------------------------------------------


class TenantShardValidator:
    """Rejects writes whose tenant is not assigned to the target shard."""

    def __init__(self, assignments: dict[str, set[str]]) -> None:
        self.assignments = assignments

    def allows(self, tenant_id: str, shard: str) -> bool:
        return shard in self.assignments.get(tenant_id, set())

    def provision_tenant(self, tenant_id: str, shards: set[str]) -> None:
        self.assignments[tenant_id] = shards


# ---------------------------------------------------------------------------
# Backfill mapping
# ---------------------------------------------------------------------------


class BackfillMapper:
    PROJECTION_FIELDS: tuple[str, ...] = (
        "title",
        "body",
        "updated_at",
        "status",
    )

    def __init__(self) -> None:
        self._mapped_count: int = 0
        self._dropped_fields: dict[str, int] = {}

    def project(self, event: ProjectionEvent) -> dict[str, object]:
        result: dict[str, object] = {}
        for field_name in self.PROJECTION_FIELDS:
            if field_name in event.fields:
                result[field_name] = event.fields[field_name]
        for field_name in event.fields:
            if field_name not in self.PROJECTION_FIELDS:
                self._dropped_fields[field_name] = (
                    self._dropped_fields.get(field_name, 0) + 1
                )
        self._mapped_count += 1
        return result

    @property
    def stats(self) -> dict[str, Any]:
        return {
            "mapped": self._mapped_count,
            "dropped_fields": dict(self._dropped_fields),
        }


# ---------------------------------------------------------------------------
# Source table protocol (for reindex)
# ---------------------------------------------------------------------------


class SourceRecord(Protocol):
    document_id: str
    tenant_id: str
    version: int
    fields: dict[str, object]
    deleted: bool


@dataclass
class SourceRow:
    document_id: str
    tenant_id: str
    version: int
    fields: dict[str, object]
    deleted: bool = False


# ---------------------------------------------------------------------------
# Reindex job
# ---------------------------------------------------------------------------


class ReindexJob:
    def __init__(
        self,
        source_query: Callable[[str | None, int], list[SourceRow]],
        projection: "SearchProjection",
        page_size: int = 500,
    ) -> None:
        self.source_query = source_query
        self.projection = projection
        self.page_size = page_size
        self._pages_processed: int = 0
        self._docs_indexed: int = 0

    def run(self) -> dict[str, int]:
        """Paginate through source table using cursor-based pagination.

        Each page fetches rows where document_id > last_seen_id, ordered
        by document_id ASC.
        """
        last_seen_id: str | None = None
        total_indexed = 0

        while True:
            page = self.source_query(last_seen_id, self.page_size)
            if not page:
                break

            self._pages_processed += 1
            self.projection.metrics.reindex_page()

            for row in page:
                event = ProjectionEvent(
                    document_id=row.document_id,
                    tenant_id=row.tenant_id,
                    version=row.version,
                    op="delete" if row.deleted else "backfill",
                    fields=row.fields,
                )
                self.projection.apply_event(event)
                total_indexed += 1

            last_seen_id = page[-1].document_id

        self._docs_indexed = total_indexed
        return {"pages": self._pages_processed, "documents": total_indexed}


# ---------------------------------------------------------------------------
# Feature flag routing
# ---------------------------------------------------------------------------


class FeatureFlagRouter:
    def __init__(
        self,
        flag_enabled: bool = False,
        old_index: str = "search-index-v1",
        new_index: str = "search-index-v2",
    ) -> None:
        self.flag_enabled = flag_enabled
        self.old_index = old_index
        self.new_index = new_index
        self._tenant_classes: dict[str, str] = {}

    def register_tenant_class(self, tenant_id: str, tenant_class: str) -> None:
        self._tenant_classes[tenant_id] = tenant_class

    def get_tenant_class(self, tenant_id: str) -> str:
        return self._tenant_classes.get(tenant_id, "standard")

    def resolve_write_index(self, tenant_id: str) -> str:
        if self.flag_enabled:
            return self.new_index
        return self.old_index

    def resolve_read_index(self, tenant_id: str) -> str:
        if self.flag_enabled and self.get_tenant_class(tenant_id) == "standard":
            return self.new_index
        return self.old_index

    def is_split(self, tenant_id: str) -> bool:
        return self.resolve_write_index(tenant_id) != self.resolve_read_index(
            tenant_id
        )


# ---------------------------------------------------------------------------
# Consistency checker
# ---------------------------------------------------------------------------


class ConsistencyChecker:
    def __init__(self, index: dict[str, IndexedDocument]) -> None:
        self.index = index

    def check_document(self, source: SourceRow) -> bool:
        doc = self.index.get(source.document_id)
        if doc is None and not source.deleted:
            return False
        if doc is not None and source.deleted and not doc.tombstoned:
            return False
        if doc is not None and doc.version < source.version:
            return False
        return True


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------


class ProjectionHealth:
    def __init__(
        self,
        lag_monitor: ReplicationLagMonitor,
        metrics: ReplicationMetrics,
    ) -> None:
        self.lag_monitor = lag_monitor
        self.metrics = metrics

    def is_healthy(self) -> bool:
        max_lag = max(
            (self.lag_monitor.lag_seconds(s) for s in self.lag_monitor.shard_versions),
            default=0.0,
        )
        return max_lag < 30.0


# ---------------------------------------------------------------------------
# Event deduplication
# ---------------------------------------------------------------------------


class EventDeduplicator:
    def __init__(self, max_size: int = 10_000) -> None:
        self._seen: set[str] = set()
        self._max_size = max_size

    def is_duplicate(self, event_id: str) -> bool:
        if event_id in self._seen:
            return True
        if len(self._seen) >= self._max_size:
            self._seen.clear()
        self._seen.add(event_id)
        return False


# ---------------------------------------------------------------------------
# Shard rebalancer
# ---------------------------------------------------------------------------


class ShardRebalancer:
    def __init__(self, current_assignments: dict[str, set[str]]) -> None:
        self.current = dict(current_assignments)

    def plan_rebalance(self, new_shard_count: int) -> list[dict[str, Any]]:
        steps: list[dict[str, Any]] = []
        for tenant_id, shards in self.current.items():
            new_shards = {
                f"{tenant_id}:shard-{i}" for i in range(new_shard_count)
            }
            added = new_shards - shards
            removed = shards - new_shards
            if added or removed:
                steps.append(
                    {
                        "tenant_id": tenant_id,
                        "add_shards": sorted(added),
                        "remove_shards": sorted(removed),
                    }
                )
        return steps


# ---------------------------------------------------------------------------
# Batch event processor
# ---------------------------------------------------------------------------


class BatchEventProcessor:
    def __init__(self, projection: "SearchProjection", batch_size: int = 100) -> None:
        self.projection = projection
        self.batch_size = batch_size

    def process_batch(self, events: list[ProjectionEvent]) -> dict[str, int]:
        shard_groups: dict[str, list[ProjectionEvent]] = {}
        for event in events:
            shard = self.projection.router.route(event.tenant_id, event.document_id)
            shard_groups.setdefault(shard, []).append(event)

        applied = 0
        for _shard, group in shard_groups.items():
            sorted_group = sorted(group, key=lambda e: e.version)
            for event in sorted_group:
                before = self.projection.metrics.counters["applied"]
                self.projection.apply_event(event)
                if self.projection.metrics.counters["applied"] > before:
                    applied += 1

        return {"applied": applied, "total": len(events)}


# ---------------------------------------------------------------------------
# Index snapshot exporter
# ---------------------------------------------------------------------------


class IndexSnapshotExporter:
    def __init__(self, index: dict[str, IndexedDocument]) -> None:
        self.index = index

    def export_tenant(self, tenant_id: str) -> list[dict[str, Any]]:
        return [
            {
                "document_id": doc.document_id,
                "tenant_id": doc.tenant_id,
                "version": doc.version,
                "fields": doc.fields,
                "tombstoned": doc.tombstoned,
            }
            for doc in self.index.values()
            if doc.tenant_id == tenant_id
        ]

    def document_versions(self) -> dict[str, int]:
        return {doc_id: doc.version for doc_id, doc in self.index.items()}


# ---------------------------------------------------------------------------
# Main projection engine
# ---------------------------------------------------------------------------


class SearchProjection:
    def __init__(self, shard_count: int = 4) -> None:
        self.index: dict[str, IndexedDocument] = {}
        self.router = ShardRouter(shard_count)
        self.metrics = ReplicationMetrics()
        self.lag_monitor = ReplicationLagMonitor()
        self.alias_manager = AliasManager(self.lag_monitor, self.metrics)
        self.backfill_mapper = BackfillMapper()
        self.version_writer = VersionGatedWriter()
        self.deduplicator = EventDeduplicator()
        self._event_log: list[str] = []

    def apply_event(self, event: ProjectionEvent) -> None:
        current = self.index.get(event.document_id)

        if current is not None and event.version < current.version:
            self.metrics.rejected_version()
            return

        tenant_id = event.tenant_id or "default"
        shard = self.router.route(event.tenant_id, event.document_id)
        self.lag_monitor.update(shard, event.version)

        if event.op == "delete":
            self.index[event.document_id] = IndexedDocument(
                document_id=event.document_id,
                tenant_id=tenant_id,
                version=event.version,
                fields={},
                tombstoned=True,
                tombstone_version=event.version,
                generation=event.generation,
            )
            self.metrics.tombstone()
            self.metrics.applied(tenant_id, shard, event.version)
            self._event_log.append(
                f"delete:{event.document_id}:v{event.version}"
            )
            return

        fields = dict(event.fields)
        if event.op == "backfill":
            fields = self.backfill_mapper.project(event)
            self.metrics.backfill_applied()

        self.index[event.document_id] = IndexedDocument(
            document_id=event.document_id,
            tenant_id=tenant_id,
            version=event.version,
            fields=fields,
            tombstoned=False,
            generation=event.generation,
        )
        self.metrics.applied(tenant_id, shard, event.version)
        self._event_log.append(
            f"{event.op}:{event.document_id}:v{event.version}"
        )

    def search(self, tenant_id: str, query: str | None = None) -> list[IndexedDocument]:
        results = [
            doc
            for doc in self.index.values()
            if doc.tenant_id == tenant_id and not doc.tombstoned
        ]
        if query:
            results = [
                doc
                for doc in results
                if any(
                    query.lower() in str(v).lower()
                    for v in doc.fields.values()
                )
            ]
        return results

    def get_document(self, document_id: str) -> IndexedDocument | None:
        doc = self.index.get(document_id)
        if doc is not None and doc.tombstoned:
            return None
        return doc

    def document_count(self, tenant_id: str | None = None) -> int:
        docs = [d for d in self.index.values() if not d.tombstoned]
        if tenant_id:
            docs = [d for d in docs if d.tenant_id == tenant_id]
        return len(docs)

    @property
    def event_log(self) -> list[str]:
        return list(self._event_log)
