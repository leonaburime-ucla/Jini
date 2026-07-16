"""Tests for the sliding window rate limiter."""

import pytest
from datetime import datetime, timezone

from src.rate_limiter import create_rate_limiter


# ---------------------------------------------------------------------------
# Construction validation
# ---------------------------------------------------------------------------

class TestInputValidation:
    def test_throws_when_window_ms_is_zero(self):
        with pytest.raises(ValueError, match="window_ms must be a positive number"):
            create_rate_limiter({"window_ms": 0, "max_requests": 10})

    def test_throws_when_window_ms_is_negative(self):
        with pytest.raises(ValueError, match="window_ms must be a positive number"):
            create_rate_limiter({"window_ms": -1, "max_requests": 10})

    def test_throws_when_max_requests_is_zero(self):
        with pytest.raises(ValueError, match="max_requests must be a positive integer"):
            create_rate_limiter({"window_ms": 1000, "max_requests": 0})

    def test_throws_when_max_requests_is_fractional(self):
        with pytest.raises(ValueError, match="max_requests must be a positive integer"):
            create_rate_limiter({"window_ms": 1000, "max_requests": 2.5})


# ---------------------------------------------------------------------------
# check_limit
# ---------------------------------------------------------------------------

class TestCheckLimit:
    def test_returns_allowed_with_full_remaining_for_unknown_client(self):
        tick = [1000]
        limiter = create_rate_limiter(
            {"window_ms": 60_000, "max_requests": 5},
            {"now": lambda: tick[0]},
        )

        status = limiter["check_limit"]("client-a")
        assert status["allowed"] is True
        assert status["remaining"] == 5
        assert isinstance(status["reset_at"], datetime)
        expected_ms = 1000 + 60_000
        assert int(status["reset_at"].timestamp() * 1000) == expected_ms

    def test_returns_reset_at_based_on_oldest_timestamp_in_the_window(self):
        tick = [1000]
        limiter = create_rate_limiter(
            {"window_ms": 60_000, "max_requests": 5},
            {"now": lambda: tick[0]},
        )

        limiter["record_request"]("c1")  # t=1000
        tick[0] = 2000
        limiter["record_request"]("c1")  # t=2000

        status = limiter["check_limit"]("c1")
        assert int(status["reset_at"].timestamp() * 1000) == 1000 + 60_000


# ---------------------------------------------------------------------------
# record_request
# ---------------------------------------------------------------------------

class TestRecordRequest:
    def test_allows_requests_under_the_limit_and_decrements_remaining(self):
        tick = [0]
        limiter = create_rate_limiter(
            {"window_ms": 60_000, "max_requests": 3},
            {"now": lambda: tick[0]},
        )

        r1 = limiter["record_request"]("c1")
        assert r1["allowed"] is True
        assert r1["remaining"] == 2

        tick[0] = 100
        r2 = limiter["record_request"]("c1")
        assert r2["allowed"] is True
        assert r2["remaining"] == 1

        tick[0] = 200
        r3 = limiter["record_request"]("c1")
        assert r3["allowed"] is True
        assert r3["remaining"] == 0

    def test_blocks_requests_at_the_limit(self):
        tick = [0]
        limiter = create_rate_limiter(
            {"window_ms": 60_000, "max_requests": 2},
            {"now": lambda: tick[0]},
        )

        limiter["record_request"]("c1")
        tick[0] = 10
        limiter["record_request"]("c1")
        tick[0] = 20

        blocked = limiter["record_request"]("c1")
        assert blocked["allowed"] is False
        assert blocked["remaining"] == 0

    def test_does_not_record_timestamp_when_request_is_rejected(self):
        tick = [0]
        limiter = create_rate_limiter(
            {"window_ms": 60_000, "max_requests": 1},
            {"now": lambda: tick[0]},
        )

        limiter["record_request"]("c1")  # fills the limit
        tick[0] = 10
        limiter["record_request"]("c1")  # rejected -- should not store

        stats = limiter["get_stats"]()
        assert stats["total_requests"] == 1  # only the one that was allowed


# ---------------------------------------------------------------------------
# Sliding window expiry (deterministic, no sleep)
# ---------------------------------------------------------------------------

class TestSlidingWindowExpiry:
    def test_expires_old_timestamps_after_the_window_elapses(self):
        tick = [0]
        limiter = create_rate_limiter(
            {"window_ms": 100, "max_requests": 2},
            {"now": lambda: tick[0]},
        )

        limiter["record_request"]("c1")  # t=0
        tick[0] = 10
        limiter["record_request"]("c1")  # t=10

        # Both within window -- should be blocked
        tick[0] = 50
        assert limiter["check_limit"]("c1")["allowed"] is False

        # Advance past the window for t=0 (window_ms=100, so t>100 expires t=0)
        tick[0] = 101
        status = limiter["check_limit"]("c1")
        assert status["allowed"] is True
        assert status["remaining"] == 1  # t=10 is still valid

    def test_fully_expires_a_client_and_removes_them_from_stats(self):
        tick = [0]
        limiter = create_rate_limiter(
            {"window_ms": 100, "max_requests": 5},
            {"now": lambda: tick[0]},
        )

        limiter["record_request"]("c1")  # t=0
        tick[0] = 200  # well past the window

        stats = limiter["get_stats"]()
        assert stats["active_clients"] == 0
        assert stats["total_requests"] == 0


# ---------------------------------------------------------------------------
# reset
# ---------------------------------------------------------------------------

class TestReset:
    def test_clears_a_specific_clients_history(self):
        tick = [0]
        limiter = create_rate_limiter(
            {"window_ms": 60_000, "max_requests": 2},
            {"now": lambda: tick[0]},
        )

        limiter["record_request"]("c1")
        limiter["record_request"]("c1")
        assert limiter["check_limit"]("c1")["allowed"] is False

        limiter["reset"]("c1")
        after = limiter["check_limit"]("c1")
        assert after["allowed"] is True
        assert after["remaining"] == 2

    def test_does_not_affect_other_clients(self):
        tick = [0]
        limiter = create_rate_limiter(
            {"window_ms": 60_000, "max_requests": 2},
            {"now": lambda: tick[0]},
        )

        limiter["record_request"]("c1")
        limiter["record_request"]("c2")
        limiter["reset"]("c1")

        assert limiter["get_stats"]()["active_clients"] == 1
        assert limiter["check_limit"]("c2")["remaining"] == 1

    def test_is_a_no_op_for_an_unknown_client(self):
        limiter = create_rate_limiter(
            {"window_ms": 60_000, "max_requests": 5},
            {"now": lambda: 0},
        )
        # Should not raise
        limiter["reset"]("nonexistent")
        assert limiter["get_stats"]()["active_clients"] == 0


# ---------------------------------------------------------------------------
# get_stats
# ---------------------------------------------------------------------------

class TestGetStats:
    def test_returns_zero_counts_when_empty(self):
        limiter = create_rate_limiter(
            {"window_ms": 60_000, "max_requests": 10},
            {"now": lambda: 0},
        )

        stats = limiter["get_stats"]()
        assert stats["active_clients"] == 0
        assert stats["total_requests"] == 0

    def test_counts_across_multiple_clients(self):
        tick = [0]
        limiter = create_rate_limiter(
            {"window_ms": 60_000, "max_requests": 100},
            {"now": lambda: tick[0]},
        )

        limiter["record_request"]("c1")
        tick[0] = 1
        limiter["record_request"]("c2")
        tick[0] = 2
        limiter["record_request"]("c2")

        stats = limiter["get_stats"]()
        assert stats["active_clients"] == 2
        assert stats["total_requests"] == 3

    def test_excludes_expired_entries_from_counts(self):
        tick = [0]
        limiter = create_rate_limiter(
            {"window_ms": 100, "max_requests": 100},
            {"now": lambda: tick[0]},
        )

        limiter["record_request"]("c1")  # t=0
        tick[0] = 50
        limiter["record_request"]("c2")  # t=50

        tick[0] = 101  # c1's request at t=0 is expired, c2's at t=50 is still valid
        stats = limiter["get_stats"]()
        assert stats["active_clients"] == 1
        assert stats["total_requests"] == 1


# ---------------------------------------------------------------------------
# Defaults (no options object)
# ---------------------------------------------------------------------------

class TestDefaults:
    def test_works_without_options_object_uses_real_clock(self):
        limiter = create_rate_limiter({"window_ms": 60_000, "max_requests": 10})
        result = limiter["record_request"]("c1")
        assert result["allowed"] is True
        assert result["remaining"] == 9
        assert result["reset_at"].timestamp() > 0


# ---------------------------------------------------------------------------
# Edge / boundary cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_boundary_timestamp_exactly_at_window_ms_is_expired(self):
        tick = [0]
        limiter = create_rate_limiter(
            {"window_ms": 100, "max_requests": 5},
            {"now": lambda: tick[0]},
        )

        limiter["record_request"]("c1")  # t=0
        tick[0] = 100  # exactly window_ms later -- t=0 should be expired (0 <= 100-100)
        status = limiter["check_limit"]("c1")
        assert status["remaining"] == 5
        assert status["allowed"] is True

    def test_handles_max_requests_of_1(self):
        tick = [0]
        limiter = create_rate_limiter(
            {"window_ms": 1000, "max_requests": 1},
            {"now": lambda: tick[0]},
        )

        r1 = limiter["record_request"]("c1")
        assert r1["allowed"] is True
        assert r1["remaining"] == 0

        tick[0] = 500
        r2 = limiter["record_request"]("c1")
        assert r2["allowed"] is False

        tick[0] = 1001
        r3 = limiter["record_request"]("c1")
        assert r3["allowed"] is True

    def test_handles_many_clients_independently(self):
        tick = [0]
        limiter = create_rate_limiter(
            {"window_ms": 60_000, "max_requests": 1},
            {"now": lambda: tick[0]},
        )

        for i in range(50):
            tick[0] = i
            result = limiter["record_request"](f"client-{i}")
            assert result["allowed"] is True

        stats = limiter["get_stats"]()
        assert stats["active_clients"] == 50
        assert stats["total_requests"] == 50
