"""Tests for cache migration coordinator."""
from __future__ import annotations

from src.cache_migration import (
    BackfillWorker,
    CacheMigrationRouter,
    DualWriteCompatibilityShim,
    InMemoryCache,
    MigrationController,
    MigrationMetrics,
    RolloutOrchestrator,
    RolloutPercentageRouter,
    SchemaTranslator,
    TenantMigrationConfig,
    build_migration_stack,
    versioned_cache_key,
)


def sample_profile_v2(user_id: str = "u-1") -> dict[str, object]:
    return {
        "user_id": user_id,
        "tenant_id": "tenant-1",
        "email": f"{user_id}@example.com",
        "display_name": "Test User",
        "risk_flags": ["manual-review"],
        "marketing_opt_in": False,
        "metadata": {"tier": "gold"},
        "created_at": 1000.0,
        "updated_at": 1000.0,
    }


def sample_profile_v1(user_id: str = "u-1") -> dict[str, object]:
    return {
        "user_id": user_id,
        "tenant_id": "tenant-1",
        "email": f"{user_id}@example.com",
        "name": "Test User",
        "marketing_opt_in": False,
        "risk_flags": ["manual-review"],
        "metadata": {"tier": "gold"},
        "created_at": 1000.0,
        "updated_at": 1000.0,
    }


class TestSchemaTranslation:
    def test_v1_to_v2_maps_name_to_display_name(self) -> None:
        v1 = sample_profile_v1()
        v2 = SchemaTranslator.v1_to_v2(v1)

        assert v2["display_name"] == "Test User"
        assert v2["user_id"] == "u-1"
        assert v2["email"] == "u-1@example.com"

    def test_v2_to_v1_maps_display_name_to_name(self) -> None:
        v2 = sample_profile_v2()
        v1 = SchemaTranslator.v2_to_v1(v2)

        assert v1["name"] == "Test User"
        assert v1["user_id"] == "u-1"

    def test_v1_to_v2_preserves_risk_flags(self) -> None:
        v1 = sample_profile_v1()
        v2 = SchemaTranslator.v1_to_v2(v1)

        assert v2["risk_flags"] == ["manual-review"]


class TestVersionedCacheKey:
    def test_includes_schema_version_and_tenant(self) -> None:
        key = versioned_cache_key("tenant-1", "u-1", "v2")
        assert key == "tenant-1:v2:profile:u-1"

    def test_different_versions_produce_different_keys(self) -> None:
        k1 = versioned_cache_key("tenant-1", "u-1", "v1")
        k2 = versioned_cache_key("tenant-1", "u-1", "v2")
        assert k1 != k2


class TestDualWriteShim:
    def test_writes_to_both_caches(self) -> None:
        legacy = InMemoryCache()
        new = InMemoryCache()
        metrics = MigrationMetrics()
        shim = DualWriteCompatibilityShim(legacy, new, metrics)

        shim.write_profile("tenant-1", "u-1", sample_profile_v2(), 1, 100.0)

        assert new.get("tenant-1:v2:profile:u-1") is not None
        assert legacy.get("tenant-1:v1:profile:u-1") is not None

    def test_v1_copy_contains_translated_fields(self) -> None:
        legacy = InMemoryCache()
        new = InMemoryCache()
        metrics = MigrationMetrics()
        shim = DualWriteCompatibilityShim(legacy, new, metrics)

        shim.write_profile("tenant-1", "u-1", sample_profile_v2(), 1, 100.0)

        entry = legacy.get("tenant-1:v1:profile:u-1")
        assert entry.value["name"] == "Test User"


class TestCacheMigrationRouter:
    def test_read_from_legacy_on_default_config(self) -> None:
        clock_time = [100.0]
        router, controller, _, _, metrics, db = build_migration_stack(
            clock=lambda: clock_time[0]
        )
        db.seed_profile("tenant-1", "u-1", sample_profile_v2())

        result = router.get_profile("tenant-1", "u-1")

        assert result is not None
        assert metrics.cache_misses == 1
        assert metrics.repopulations == 1

    def test_write_with_dual_write_populates_both(self) -> None:
        clock_time = [100.0]
        router, controller, _, _, metrics, db = build_migration_stack(
            clock=lambda: clock_time[0]
        )
        config = controller.get_config("tenant-1")
        config.write_v2 = True
        config.dual_write = True

        router.write_profile("tenant-1", "u-1", sample_profile_v2())

        v2_entry = router._new.get("tenant-1:v2:profile:u-1")
        v1_entry = router._legacy.get("tenant-1:v1:profile:u-1")
        assert v2_entry is not None
        assert v1_entry is not None

    def test_read_returns_none_for_missing_user(self) -> None:
        router, *_ = build_migration_stack(clock=lambda: 100.0)

        result = router.get_profile("tenant-1", "nonexistent")
        assert result is None

    def test_tombstone_written_on_miss(self) -> None:
        router, *_ = build_migration_stack(clock=lambda: 100.0)

        router.get_profile("tenant-1", "ghost-user")

        entry = router._legacy.get("tenant-1:v1:profile:ghost-user")
        assert entry is not None
        assert entry.is_tombstone is True


class TestBackfillWorker:
    def test_backfills_uncached_profiles(self) -> None:
        router, controller, backfill, _, metrics, db = build_migration_stack(
            clock=lambda: 100.0
        )
        db.seed_profile("tenant-1", "u-1", sample_profile_v2())
        db.seed_profile("tenant-1", "u-2", sample_profile_v2("u-2"))

        filled = backfill.backfill_tenant("tenant-1", generation=1, now=100.0)

        assert filled == 2

    def test_skips_already_cached_profiles(self) -> None:
        router, controller, backfill, _, metrics, db = build_migration_stack(
            clock=lambda: 100.0
        )
        db.seed_profile("tenant-1", "u-1", sample_profile_v2())
        config = controller.get_config("tenant-1")
        config.write_v2 = True
        router.write_profile("tenant-1", "u-1", sample_profile_v2())

        filled = backfill.backfill_tenant("tenant-1", generation=2, now=200.0)

        assert filled == 0


class TestMigrationController:
    def test_promote_succeeds_when_backfill_complete(self) -> None:
        controller = MigrationController()
        config = TenantMigrationConfig(
            tenant_id="tenant-1", backfill_complete=True
        )
        controller.register_tenant(config)

        assert controller.promote_tenant("tenant-1") is True
        assert config.promoted is True

    def test_promote_fails_without_backfill(self) -> None:
        controller = MigrationController()
        config = TenantMigrationConfig(
            tenant_id="tenant-1", backfill_complete=False
        )
        controller.register_tenant(config)

        assert controller.promote_tenant("tenant-1") is False

    def test_rollback_clears_promotion_flags(self) -> None:
        controller = MigrationController()
        config = TenantMigrationConfig(
            tenant_id="tenant-1",
            read_new=True,
            write_v2=True,
            dual_write=True,
            promoted=True,
        )
        controller.register_tenant(config)

        controller.rollback_tenant("tenant-1")

        assert config.promoted is False
        assert config.read_new is False
        assert config.dual_write is False


class TestRolloutOrchestrator:
    def test_full_promotion_flow(self) -> None:
        clock_time = [100.0]
        router, controller, backfill, orchestrator, metrics, db = (
            build_migration_stack(clock=lambda: clock_time[0])
        )
        db.seed_profile("tenant-1", "u-1", sample_profile_v2())

        orchestrator.enable_dual_write("tenant-1")
        orchestrator.start_backfill("tenant-1")

        assert orchestrator.attempt_promotion("tenant-1") is True

    def test_promotion_log_records_attempts(self) -> None:
        clock_time = [200.0]
        _, controller, _, orchestrator, _, db = build_migration_stack(
            clock=lambda: clock_time[0]
        )

        orchestrator.attempt_promotion("tenant-1")

        log = orchestrator.get_promotion_log()
        assert len(log) == 1
        assert log[0]["tenant_id"] == "tenant-1"


class TestRolloutPercentageRouter:
    def test_zero_percent_routes_nothing_new(self) -> None:
        rpr = RolloutPercentageRouter(rollout_pct=0)
        assert rpr.should_route_new("t1", "u-1") is False

    def test_hundred_percent_routes_all_new(self) -> None:
        rpr = RolloutPercentageRouter(rollout_pct=100)
        assert rpr.should_route_new("t1", "u-1") is True
