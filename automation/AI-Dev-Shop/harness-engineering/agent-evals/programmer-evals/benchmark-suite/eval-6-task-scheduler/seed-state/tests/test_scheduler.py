"""Tests for the task scheduler."""

import asyncio
import math
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from src.scheduler import handle_task, score_priority, assign_task


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Fixed reference timestamp for deterministic tests: 2026-06-01T00:00:00Z
FIXED_NOW = int(datetime(2026, 6, 1, tzinfo=timezone.utc).timestamp() * 1000)


def fixed_clock():
    return FIXED_NOW


def future_date(days: float) -> str:
    """Return an ISO date string N days after FIXED_NOW."""
    ts = FIXED_NOW + days * 24 * 60 * 60 * 1000
    return datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def past_date(days: float) -> str:
    """Return an ISO date string N days before FIXED_NOW."""
    ts = FIXED_NOW - days * 24 * 60 * 60 * 1000
    return datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def build_input(overrides: dict | None = None) -> dict:
    """Build a valid TaskInput with sensible defaults, overridable per-field."""
    base = {
        "title": "Fix login bug",
        "description": "Users cannot log in on Safari",
        "priority": "high",
        "due_date": future_date(7),
        "assignee_id": "user-42",
        "tags": ["bug", "frontend"],
    }
    if overrides:
        base.update(overrides)
    return base


# Stub ID generator for deterministic task IDs.
stub_id = lambda: "task-test-001"


def build_workload_service(overrides: dict | None = None):
    """Create a mock WorkloadService with configurable capacity."""
    overrides = overrides or {}
    active = overrides.get("active_tasks", 2)
    max_t = overrides.get("max_tasks", 10)

    ws = MagicMock()

    if overrides.get("get_throws"):
        ws.get_assignee = AsyncMock(side_effect=overrides["get_throws"])
    else:
        ws.get_assignee = AsyncMock(
            return_value={
                "id": "user-42",
                "max_tasks": max_t,
                "active_tasks": active,
                "completed_tasks": 5,
            }
        )

    if overrides.get("record_throws"):
        ws.record_assignment = AsyncMock(side_effect=overrides["record_throws"])
    else:
        ws.record_assignment = AsyncMock(return_value=None)

    return ws


def is_result(r: dict) -> bool:
    """Type guard: result is a successful ScheduleResult."""
    return "task_id" in r


def is_error(r: dict) -> bool:
    """Type guard: result is a ScheduleError."""
    return "error" in r


# ---------------------------------------------------------------------------
# score_priority -- pure scoring
# ---------------------------------------------------------------------------

class TestScorePriority:
    def test_returns_the_base_score_for_a_far_future_due_date_with_no_tags(self):
        # 100 days out => urgency bonus = max(0, 30 - 200) = 0
        score = score_priority(
            {"priority": "high", "due_date": future_date(100), "tags": []},
            {"now": fixed_clock},
        )
        assert score == 60

    def test_returns_base_plus_urgency_for_a_near_due_date(self):
        # 5 days out => urgency = round(30 - 10) = 20
        score = score_priority(
            {"priority": "low", "due_date": future_date(5), "tags": []},
            {"now": fixed_clock},
        )
        assert score == 10 + 20  # 30

    def test_caps_urgency_bonus_at_30_when_due_date_is_today(self):
        # ~0 days => urgency = 30
        score = score_priority(
            {"priority": "low", "due_date": future_date(0.001), "tags": []},
            {"now": fixed_clock},
        )
        # base 10 + urgency 30 = 40
        assert score == 40

    def test_adds_tag_weights_from_the_options_parameter(self):
        score = score_priority(
            {"priority": "medium", "due_date": future_date(100), "tags": ["security", "p0"]},
            {"tag_weights": {"security": 15, "p0": 10}, "now": fixed_clock},
        )
        # base 30 + urgency 0 + tags 25 = 55
        assert score == 55

    def test_ignores_unknown_tags_gracefully(self):
        score = score_priority(
            {"priority": "medium", "due_date": future_date(100), "tags": ["unknown"]},
            {"tag_weights": {"security": 15}, "now": fixed_clock},
        )
        assert score == 30

    def test_clamps_total_score_to_100(self):
        score = score_priority(
            {"priority": "critical", "due_date": future_date(0.001), "tags": ["bonus"]},
            {"tag_weights": {"bonus": 50}, "now": fixed_clock},
        )
        assert score == 100

    def test_returns_higher_scores_for_critical_than_low_priority(self):
        low = score_priority(
            {"priority": "low", "due_date": future_date(10), "tags": []},
            {"now": fixed_clock},
        )
        critical = score_priority(
            {"priority": "critical", "due_date": future_date(10), "tags": []},
            {"now": fixed_clock},
        )
        assert critical > low

    def test_uses_default_time_when_no_clock_is_provided(self):
        score = score_priority(
            {"priority": "medium", "due_date": future_date(100), "tags": []},
        )
        assert isinstance(score, int)
        assert 0 <= score <= 100

    def test_returns_base_score_with_empty_tags_array(self):
        score = score_priority(
            {"priority": "critical", "due_date": future_date(100), "tags": []},
            {"now": fixed_clock},
        )
        assert score == 90


# ---------------------------------------------------------------------------
# assign_task
# ---------------------------------------------------------------------------

class TestAssignTask:
    @pytest.mark.asyncio
    async def test_returns_assignee_id_when_user_has_capacity(self):
        ws = build_workload_service({"active_tasks": 2, "max_tasks": 10})
        result = await assign_task(
            {"task_id": "task-1", "assignee_id": "user-42"},
            {"workload_service": ws},
        )
        assert result == "user-42"
        ws.record_assignment.assert_called_with("task-1", "user-42")

    @pytest.mark.asyncio
    async def test_returns_none_when_user_is_at_max_capacity(self):
        ws = build_workload_service({"active_tasks": 10, "max_tasks": 10})
        result = await assign_task(
            {"task_id": "task-1", "assignee_id": "user-42"},
            {"workload_service": ws},
        )
        assert result is None
        ws.record_assignment.assert_not_called()

    @pytest.mark.asyncio
    async def test_returns_none_when_user_is_over_capacity(self):
        ws = build_workload_service({"active_tasks": 12, "max_tasks": 10})
        result = await assign_task(
            {"task_id": "task-1", "assignee_id": "user-42"},
            {"workload_service": ws},
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_awaits_record_assignment_before_returning(self):
        recorded = [False]

        async def mock_record(*args):
            recorded[0] = True

        ws = MagicMock()
        ws.get_assignee = AsyncMock(
            return_value={
                "id": "user-42",
                "max_tasks": 10,
                "active_tasks": 2,
                "completed_tasks": 0,
            }
        )
        ws.record_assignment = AsyncMock(side_effect=mock_record)

        result = await assign_task(
            {"task_id": "task-1", "assignee_id": "user-42"},
            {"workload_service": ws},
        )
        assert result == "user-42"
        assert recorded[0] is True

    @pytest.mark.asyncio
    async def test_propagates_workload_service_errors(self):
        ws = build_workload_service(
            {"get_throws": Exception("service unavailable")}
        )
        with pytest.raises(Exception, match="service unavailable"):
            await assign_task(
                {"task_id": "task-1", "assignee_id": "user-42"},
                {"workload_service": ws},
            )


# ---------------------------------------------------------------------------
# handle_task -- validation
# ---------------------------------------------------------------------------

class TestHandleTaskValidation:
    @pytest.mark.asyncio
    async def test_rejects_empty_title(self):
        result = await handle_task(
            build_input({"title": ""}),
            {"now": fixed_clock, "generate_id": stub_id},
        )
        assert is_error(result)
        assert result["error"] == "Title is required"

    @pytest.mark.asyncio
    async def test_rejects_whitespace_only_title(self):
        result = await handle_task(
            build_input({"title": "   "}),
            {"now": fixed_clock, "generate_id": stub_id},
        )
        assert is_error(result)
        assert result["error"] == "Title is required"

    @pytest.mark.asyncio
    async def test_rejects_invalid_priority(self):
        result = await handle_task(
            build_input({"priority": "urgent"}),
            {"now": fixed_clock, "generate_id": stub_id},
        )
        assert is_error(result)
        assert result["error"] == "Invalid priority: urgent"

    @pytest.mark.asyncio
    async def test_rejects_past_due_date(self):
        result = await handle_task(
            build_input({"due_date": past_date(5)}),
            {"now": fixed_clock, "generate_id": stub_id},
        )
        assert is_error(result)
        assert "future" in result["error"]

    @pytest.mark.asyncio
    async def test_rejects_unparseable_due_date(self):
        result = await handle_task(
            build_input({"due_date": "not-a-date"}),
            {"now": fixed_clock, "generate_id": stub_id},
        )
        assert is_error(result)
        assert "valid date" in result["error"]


# ---------------------------------------------------------------------------
# handle_task -- success paths
# ---------------------------------------------------------------------------

class TestHandleTaskSuccess:
    @pytest.mark.asyncio
    async def test_returns_a_full_schedule_result_with_workload_service(self):
        ws = build_workload_service()
        result = await handle_task(
            build_input(),
            {
                "now": fixed_clock,
                "generate_id": stub_id,
                "workload_service": ws,
            },
        )

        assert is_result(result)
        assert result["task_id"] == "task-test-001"
        assert isinstance(result["priority_score"], int)
        assert 0 <= result["priority_score"] <= 100
        assert result["assigned_to"] == "user-42"
        expected_ts = datetime.fromtimestamp(
            FIXED_NOW / 1000, tz=timezone.utc
        ).isoformat().replace("+00:00", "Z")
        assert result["scheduled_at"] == expected_ts
        assert result["warnings"] == []

    @pytest.mark.asyncio
    async def test_includes_a_warning_when_assignee_is_at_capacity(self):
        ws = build_workload_service({"active_tasks": 10, "max_tasks": 10})
        result = await handle_task(
            build_input(),
            {
                "now": fixed_clock,
                "generate_id": stub_id,
                "workload_service": ws,
            },
        )

        assert is_result(result)
        assert result["assigned_to"] is None
        assert len(result["warnings"]) == 1
        assert "at capacity" in result["warnings"][0]

    @pytest.mark.asyncio
    async def test_includes_a_warning_when_no_workload_service_is_provided(self):
        result = await handle_task(
            build_input(),
            {"now": fixed_clock, "generate_id": stub_id},
        )

        assert is_result(result)
        assert result["assigned_to"] is None
        assert len(result["warnings"]) == 1
        assert "No workload service" in result["warnings"][0]

    @pytest.mark.asyncio
    async def test_includes_a_warning_when_workload_service_throws(self):
        ws = build_workload_service(
            {"get_throws": Exception("connection refused")}
        )
        result = await handle_task(
            build_input(),
            {
                "now": fixed_clock,
                "generate_id": stub_id,
                "workload_service": ws,
            },
        )

        assert is_result(result)
        assert result["assigned_to"] is None
        assert len(result["warnings"]) == 1
        assert "connection refused" in result["warnings"][0]

    @pytest.mark.asyncio
    async def test_applies_tag_weights_from_options(self):
        ws = build_workload_service()
        with_tags = await handle_task(
            build_input({"tags": ["security"]}),
            {
                "now": fixed_clock,
                "generate_id": stub_id,
                "tag_weights": {"security": 15},
                "workload_service": ws,
            },
        )
        without_tags = await handle_task(
            build_input({"tags": []}),
            {
                "now": fixed_clock,
                "generate_id": stub_id,
                "workload_service": ws,
            },
        )

        assert is_result(with_tags)
        assert is_result(without_tags)
        assert with_tags["priority_score"] > without_tags["priority_score"]

    @pytest.mark.asyncio
    async def test_uses_custom_id_generator(self):
        result = await handle_task(
            build_input(),
            {"now": fixed_clock, "generate_id": lambda: "custom-id-abc"},
        )

        assert is_result(result)
        assert result["task_id"] == "custom-id-abc"

    @pytest.mark.asyncio
    async def test_produces_a_valid_iso_scheduled_at_timestamp(self):
        result = await handle_task(
            build_input(),
            {"now": fixed_clock, "generate_id": stub_id},
        )

        assert is_result(result)
        # Verify it's a valid ISO timestamp by round-tripping
        parsed = datetime.fromisoformat(result["scheduled_at"].replace("Z", "+00:00"))
        assert parsed.isoformat().replace("+00:00", "Z") == result["scheduled_at"]
