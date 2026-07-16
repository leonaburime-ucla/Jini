"""
Cache migration coordinator for user-profile lookups.

Manages the zero-downtime rolling migration from legacy Redis to new cache
backend with dual-write synchronization, progressive tenant promotion, schema
translation between v1 and v2, and read-through repopulation from PostgreSQL.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from hashlib import sha256
from typing import Callable, Protocol


# ---------------------------------------------------------------------------
# Domain types
# ---------------------------------------------------------------------------

@dataclass
class UserProfile:
    user_id: str
    tenant_id: str
    email: str
    display_name: str
    risk_flags: list[str] = field(default_factory=list)
    marketing_opt_in: bool = False
    metadata: dict[str, object] = field(default_factory=dict)
    created_at: float = 0.0
    updated_at: float = 0.0


@dataclass(frozen=True)
class CacheEntry:
    key: str
    value: dict[str, object]
    schema_version: str
    ttl_seconds: int
    written_at: float
    generation: int
    is_tombstone: bool = False


@dataclass
class TenantMigrationConfig:
    tenant_id: str
    read_new: bool = False
    write_v2: bool = False
    dual_write: bool = False
    backfill_running: bool = False
    backfill_complete: bool = False
    promoted: bool = False


# ---------------------------------------------------------------------------
# Cache key utilities
# ---------------------------------------------------------------------------

def versioned_cache_key(
    tenant_id: str, user_id: str, schema_version: str
) -> str:
    return f"{tenant_id}:{schema_version}:profile:{user_id}"


def legacy_cache_key(tenant_id: str, user_id: str) -> str:
    return f"{tenant_id}:profile:{user_id}"


# ---------------------------------------------------------------------------
# Schema translation
# ---------------------------------------------------------------------------

class SchemaTranslator:

    @staticmethod
    def v1_to_v2(profile: dict[str, object]) -> dict[str, object]:
        return {
            "user_id": profile["user_id"],
            "tenant_id": profile.get("tenant_id", ""),
            "email": profile["email"],
            "display_name": profile.get("display_name", profile.get("name", "")),
            "risk_flags": list(profile.get("risk_flags", [])),
            "marketing_opt_in": profile.get("marketing_opt_in", True),
            "metadata": dict(profile.get("metadata", {})),
            "created_at": profile.get("created_at", 0.0),
            "updated_at": profile.get("updated_at", 0.0),
        }

    @staticmethod
    def v2_to_v1(profile: dict[str, object]) -> dict[str, object]:
        return {
            "user_id": profile["user_id"],
            "tenant_id": profile.get("tenant_id", ""),
            "email": profile["email"],
            "name": profile.get("display_name", ""),
            "marketing_opt_in": profile.get("marketing_opt_in", False),
            "metadata": dict(profile.get("metadata", {})),
            "created_at": profile.get("created_at", 0.0),
            "updated_at": profile.get("updated_at", 0.0),
        }


# ---------------------------------------------------------------------------
# Cache backends
# ---------------------------------------------------------------------------

class CacheBackend(Protocol):
    def get(self, key: str) -> CacheEntry | None: ...
    def put(self, entry: CacheEntry) -> None: ...
    def delete(self, key: str) -> None: ...
    def exists(self, key: str) -> bool: ...


class InMemoryCache:
    def __init__(self) -> None:
        self._store: dict[str, CacheEntry] = {}

    def get(self, key: str) -> CacheEntry | None:
        return self._store.get(key)

    def put(self, entry: CacheEntry) -> None:
        self._store[entry.key] = entry

    def delete(self, key: str) -> None:
        self._store.pop(key, None)

    def exists(self, key: str) -> bool:
        return key in self._store

    def keys(self) -> list[str]:
        return list(self._store.keys())

    def clear_tenant(self, tenant_id: str) -> int:
        removed = 0
        for key in list(self._store):
            if key.startswith(f"{tenant_id}:"):
                del self._store[key]
                removed += 1
        return removed


# ---------------------------------------------------------------------------
# Database adapter
# ---------------------------------------------------------------------------

class ProfileDatabase:
    def __init__(
        self,
        latency_ms: float = 80.0,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self._profiles: dict[tuple[str, str], dict[str, object]] = {}
        self._latency_ms = latency_ms
        self._clock = clock or time.time

    def get_profile(
        self, tenant_id: str, user_id: str
    ) -> dict[str, object] | None:
        return self._profiles.get((tenant_id, user_id))

    def save_profile(
        self, tenant_id: str, user_id: str, profile: dict[str, object]
    ) -> None:
        self._profiles[(tenant_id, user_id)] = dict(profile)

    def exists(self, tenant_id: str, user_id: str) -> bool:
        return (tenant_id, user_id) in self._profiles

    def list_users(self, tenant_id: str) -> list[str]:
        return [
            uid for (tid, uid) in self._profiles if tid == tenant_id
        ]


# ---------------------------------------------------------------------------
# Migration metrics
# ---------------------------------------------------------------------------

class MigrationMetrics:
    def __init__(self) -> None:
        self.cache_hits: dict[str, int] = {"legacy": 0, "new": 0}
        self.cache_misses: int = 0
        self.repopulations: int = 0
        self.shadow_mismatches: int = 0
        self.schema_translations: int = 0
        self.tombstone_hits: int = 0
        self.promotion_attempts: int = 0
        self.promotion_failures: int = 0

    def record_hit(self, backend: str) -> None:
        self.cache_hits[backend] = self.cache_hits.get(backend, 0) + 1

    def record_miss(self) -> None:
        self.cache_misses += 1

    def record_repopulation(self) -> None:
        self.repopulations += 1

    def record_shadow_mismatch(self) -> None:
        self.shadow_mismatches += 1

    def record_translation(self) -> None:
        self.schema_translations += 1

    def record_tombstone_hit(self) -> None:
        self.tombstone_hits += 1


# ---------------------------------------------------------------------------
# Dual-write compatibility shim
# ---------------------------------------------------------------------------

class DualWriteCompatibilityShim:

    def __init__(
        self,
        legacy_cache: InMemoryCache,
        new_cache: InMemoryCache,
        metrics: MigrationMetrics,
    ) -> None:
        self._legacy = legacy_cache
        self._new = new_cache
        self._metrics = metrics

    def write_profile(
        self,
        tenant_id: str,
        user_id: str,
        profile_v2: dict[str, object],
        generation: int,
        now: float,
    ) -> None:
        v2_key = versioned_cache_key(tenant_id, user_id, "v2")
        v1_key = versioned_cache_key(tenant_id, user_id, "v1")

        self._new.put(CacheEntry(
            key=v2_key,
            value=dict(profile_v2),
            schema_version="v2",
            ttl_seconds=300,
            written_at=now,
            generation=generation,
        ))

        v1_profile = SchemaTranslator.v2_to_v1(profile_v2)
        self._legacy.put(CacheEntry(
            key=v1_key,
            value=v1_profile,
            schema_version="v1",
            ttl_seconds=300,
            written_at=now,
            generation=generation,
        ))
        self._metrics.record_translation()


# ---------------------------------------------------------------------------
# Backfill worker
# ---------------------------------------------------------------------------

class BackfillWorker:

    def __init__(
        self,
        database: ProfileDatabase,
        new_cache: InMemoryCache,
        metrics: MigrationMetrics,
        batch_size: int = 100,
    ) -> None:
        self._db = database
        self._cache = new_cache
        self._metrics = metrics
        self._batch_size = batch_size
        self._progress: dict[str, int] = {}

    def backfill_tenant(
        self, tenant_id: str, generation: int, now: float
    ) -> int:
        users = self._db.list_users(tenant_id)
        filled = 0
        for user_id in users:
            profile = self._db.get_profile(tenant_id, user_id)
            if profile is None:
                continue
            key = versioned_cache_key(tenant_id, user_id, "v2")
            if not self._cache.exists(key):
                self._cache.put(CacheEntry(
                    key=key,
                    value=dict(profile),
                    schema_version="v2",
                    ttl_seconds=600,
                    written_at=now,
                    generation=generation,
                ))
                filled += 1
        self._progress[tenant_id] = filled
        return filled

    def get_progress(self, tenant_id: str) -> int:
        return self._progress.get(tenant_id, 0)


# ---------------------------------------------------------------------------
# Migration controller
# ---------------------------------------------------------------------------

class MigrationController:

    def __init__(
        self,
        configs: dict[str, TenantMigrationConfig] | None = None,
    ) -> None:
        self._configs: dict[str, TenantMigrationConfig] = configs or {}
        self._generation_ledger: dict[str, int] = {}

    def register_tenant(self, config: TenantMigrationConfig) -> None:
        self._configs[config.tenant_id] = config

    def get_config(self, tenant_id: str) -> TenantMigrationConfig | None:
        return self._configs.get(tenant_id)

    def update_generation(self, tenant_id: str, generation: int) -> None:
        self._generation_ledger[tenant_id] = generation

    def get_generation(self, tenant_id: str) -> int:
        return self._generation_ledger.get(tenant_id, 0)

    def promote_tenant(self, tenant_id: str) -> bool:
        config = self._configs.get(tenant_id)
        if config is None:
            return False
        if not config.backfill_complete:
            return False
        config.promoted = True
        config.read_new = True
        return True

    def rollback_tenant(self, tenant_id: str) -> bool:
        config = self._configs.get(tenant_id)
        if config is None:
            return False
        config.promoted = False
        config.read_new = False
        config.write_v2 = False
        config.dual_write = False
        return True

    def list_promoted(self) -> list[str]:
        return [
            tid for tid, cfg in self._configs.items() if cfg.promoted
        ]


# ---------------------------------------------------------------------------
# Cache migration router
# ---------------------------------------------------------------------------

class CacheMigrationRouter:

    def __init__(
        self,
        legacy_cache: InMemoryCache,
        new_cache: InMemoryCache,
        database: ProfileDatabase,
        controller: MigrationController,
        metrics: MigrationMetrics,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self._legacy = legacy_cache
        self._new = new_cache
        self._db = database
        self._controller = controller
        self._metrics = metrics
        self._clock = clock or time.time
        self._generation: int = 0
        self._dual_shim = DualWriteCompatibilityShim(
            legacy_cache, new_cache, metrics
        )

    @property
    def current_generation(self) -> int:
        return self._generation

    def _next_generation(self) -> int:
        self._generation += 1
        return self._generation

    def get_profile(
        self, tenant_id: str, user_id: str
    ) -> dict[str, object] | None:
        config = self._controller.get_config(tenant_id)
        if config is None:
            config = TenantMigrationConfig(tenant_id=tenant_id)

        if config.read_new:
            v2_key = versioned_cache_key(tenant_id, user_id, "v2")
            entry = self._new.get(v2_key)
            if entry is not None:
                if entry.is_tombstone:
                    self._metrics.record_tombstone_hit()
                    return None
                self._metrics.record_hit("new")
                return dict(entry.value)

        legacy_key = versioned_cache_key(tenant_id, user_id, "v1")
        legacy_entry = self._legacy.get(legacy_key)
        if legacy_entry is not None:
            if legacy_entry.is_tombstone:
                self._metrics.record_tombstone_hit()
                return None
            self._metrics.record_hit("legacy")
            return dict(legacy_entry.value)

        self._metrics.record_miss()
        db_profile = self._db.get_profile(tenant_id, user_id)
        if db_profile is None:
            self._write_tombstone(tenant_id, user_id)
            return None

        now = self._clock()
        v1_data = SchemaTranslator.v2_to_v1(db_profile)
        self.repopulate_legacy_cache(tenant_id, user_id, v1_data, now)
        self._metrics.record_repopulation()
        return db_profile

    def write_profile(
        self,
        tenant_id: str,
        user_id: str,
        profile: dict[str, object],
    ) -> None:
        config = self._controller.get_config(tenant_id)
        if config is None:
            config = TenantMigrationConfig(tenant_id=tenant_id)

        now = self._clock()
        generation = self._next_generation()
        profile["updated_at"] = now

        self._db.save_profile(tenant_id, user_id, profile)

        self._invalidate_tombstones(tenant_id, user_id)

        if config.dual_write:
            self._dual_shim.write_profile(
                tenant_id, user_id, profile, generation, now
            )
            self._controller.update_generation(tenant_id, generation)
        elif config.write_v2:
            v2_key = versioned_cache_key(tenant_id, user_id, "v2")
            self._new.put(CacheEntry(
                key=v2_key,
                value=dict(profile),
                schema_version="v2",
                ttl_seconds=300,
                written_at=now,
                generation=generation,
            ))
            self._controller.update_generation(tenant_id, generation)
        else:
            v1_key = versioned_cache_key(tenant_id, user_id, "v1")
            v1_data = SchemaTranslator.v2_to_v1(profile)
            self._legacy.put(CacheEntry(
                key=v1_key,
                value=v1_data,
                schema_version="v1",
                ttl_seconds=300,
                written_at=now,
                generation=generation,
            ))

    def repopulate_legacy_cache(
        self,
        tenant_id: str,
        user_id: str,
        snapshot: dict[str, object],
        now: float,
    ) -> None:
        key = versioned_cache_key(tenant_id, user_id, "v1")
        self._legacy.put(CacheEntry(
            key=key,
            value=dict(snapshot),
            schema_version="v1",
            ttl_seconds=300,
            written_at=now,
            generation=0,
        ))

    def _write_tombstone(self, tenant_id: str, user_id: str) -> None:
        now = self._clock()
        legacy_key = versioned_cache_key(tenant_id, user_id, "v1")
        self._legacy.put(CacheEntry(
            key=legacy_key,
            value={},
            schema_version="v1",
            ttl_seconds=60,
            written_at=now,
            generation=self._generation,
            is_tombstone=True,
        ))

    def _invalidate_tombstones(self, tenant_id: str, user_id: str) -> None:
        v2_key = versioned_cache_key(tenant_id, user_id, "v2")
        v2_entry = self._new.get(v2_key)
        if v2_entry is not None and v2_entry.is_tombstone:
            self._new.delete(v2_key)

    def shadow_read(
        self, tenant_id: str, user_id: str
    ) -> tuple[dict[str, object] | None, dict[str, object] | None]:
        legacy_key = versioned_cache_key(tenant_id, user_id, "v1")
        v2_key = versioned_cache_key(tenant_id, user_id, "v2")

        legacy_entry = self._legacy.get(legacy_key)
        v2_entry = self._new.get(v2_key)

        legacy_val = dict(legacy_entry.value) if legacy_entry else None
        v2_val = dict(v2_entry.value) if v2_entry else None

        if legacy_val is not None and v2_val is not None:
            upgraded = SchemaTranslator.v1_to_v2(legacy_val)
            if upgraded != v2_val:
                self._metrics.record_shadow_mismatch()

        return legacy_val, v2_val


# ---------------------------------------------------------------------------
# Rollout orchestrator
# ---------------------------------------------------------------------------

class RolloutOrchestrator:

    def __init__(
        self,
        router: CacheMigrationRouter,
        controller: MigrationController,
        backfill: BackfillWorker,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self._router = router
        self._controller = controller
        self._backfill = backfill
        self._clock = clock or time.time
        self._cohort_size = 50
        self._promotion_log: list[dict[str, object]] = []

    def enable_dual_write(self, tenant_id: str) -> bool:
        config = self._controller.get_config(tenant_id)
        if config is None:
            return False
        config.write_v2 = True
        config.dual_write = True
        return True

    def start_backfill(self, tenant_id: str) -> int:
        config = self._controller.get_config(tenant_id)
        if config is None:
            return 0
        config.backfill_running = True
        generation = self._router.current_generation
        filled = self._backfill.backfill_tenant(
            tenant_id, generation, self._clock()
        )
        config.backfill_running = False
        config.backfill_complete = True
        return filled

    def attempt_promotion(self, tenant_id: str) -> bool:
        config = self._controller.get_config(tenant_id)
        if config is None:
            return False

        success = self._controller.promote_tenant(tenant_id)
        now = self._clock()
        self._promotion_log.append({
            "tenant_id": tenant_id,
            "success": success,
            "timestamp": now,
            "generation": self._controller.get_generation(tenant_id),
        })
        return success

    def rollback(self, tenant_id: str) -> bool:
        return self._controller.rollback_tenant(tenant_id)

    def get_promotion_log(self) -> list[dict[str, object]]:
        return list(self._promotion_log)

    def cohort_promote(self, tenant_ids: list[str]) -> dict[str, bool]:
        results: dict[str, bool] = {}
        for tenant_id in tenant_ids[:self._cohort_size]:
            results[tenant_id] = self.attempt_promotion(tenant_id)
        return results


# ---------------------------------------------------------------------------
# Rollout percentage calculator
# ---------------------------------------------------------------------------

class RolloutPercentageRouter:

    def __init__(self, rollout_pct: int = 0) -> None:
        self._pct = min(max(rollout_pct, 0), 100)

    def set_percentage(self, pct: int) -> None:
        self._pct = min(max(pct, 0), 100)

    def should_route_new(self, tenant_id: str, user_id: str) -> bool:
        digest = sha256(
            f"{tenant_id}:{user_id}".encode("utf-8")
        ).hexdigest()
        bucket = int(digest[:8], 16) % 100
        return bucket < self._pct

    @property
    def current_percentage(self) -> int:
        return self._pct


# ---------------------------------------------------------------------------
# Simulated services for testing
# ---------------------------------------------------------------------------

class InMemoryProfileDatabase(ProfileDatabase):

    def __init__(self) -> None:
        super().__init__(latency_ms=0.0)

    def seed_profile(
        self, tenant_id: str, user_id: str, profile: dict[str, object]
    ) -> None:
        self.save_profile(tenant_id, user_id, profile)


def build_migration_stack(
    tenant_id: str = "tenant-1",
    clock: Callable[[], float] | None = None,
) -> tuple[
    CacheMigrationRouter,
    MigrationController,
    BackfillWorker,
    RolloutOrchestrator,
    MigrationMetrics,
    InMemoryProfileDatabase,
]:
    legacy = InMemoryCache()
    new = InMemoryCache()
    db = InMemoryProfileDatabase()
    metrics = MigrationMetrics()
    controller = MigrationController()
    controller.register_tenant(TenantMigrationConfig(tenant_id=tenant_id))

    router = CacheMigrationRouter(
        legacy_cache=legacy,
        new_cache=new,
        database=db,
        controller=controller,
        metrics=metrics,
        clock=clock,
    )

    backfill = BackfillWorker(
        database=db,
        new_cache=new,
        metrics=metrics,
    )

    orchestrator = RolloutOrchestrator(
        router=router,
        controller=controller,
        backfill=backfill,
        clock=clock,
    )

    return router, controller, backfill, orchestrator, metrics, db
