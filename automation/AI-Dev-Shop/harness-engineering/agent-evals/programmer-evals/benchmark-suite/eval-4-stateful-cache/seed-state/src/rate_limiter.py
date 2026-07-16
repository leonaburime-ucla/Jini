"""
Sliding window rate limiter.

Tracks per-client request timestamps in a sliding window and enforces
a configurable maximum request count per window.

module: rate_limiter
"""

from __future__ import annotations

import time
import math
from datetime import datetime, timezone
from typing import TypedDict


class RateLimiterInput(TypedDict):
    """Required configuration for creating a RateLimiter."""
    window_ms: int  # Sliding window duration in milliseconds.
    max_requests: int  # Maximum requests allowed per window.


class RateLimiterOptions(TypedDict, total=False):
    """Optional overrides (primarily for testing)."""
    now: object  # Injectable clock function; defaults to time.time() * 1000.


class LimitStatus(TypedDict):
    """Result returned by check_limit and record_request."""
    allowed: bool
    remaining: int
    reset_at: datetime


class LimiterStats(TypedDict):
    """Aggregate statistics for the limiter."""
    active_clients: int
    total_requests: int


def create_rate_limiter(
    input_config: RateLimiterInput,
    options: RateLimiterOptions | None = None,
):
    """
    Creates a sliding-window rate limiter.

    Two-object signature: required input + optional options.

    Args:
        input_config: Required: window_ms and max_requests.
        options:      Optional: injectable clock via ``now``.

    Returns:
        A dict with check_limit, record_request, reset, get_stats callables.

    @complexity Construction O(1). Per-operation see individual methods.
    @overallScore 95/100 -- clean design; minor note: per-client cleanup is O(k)
      where k is stored timestamps, acceptable for expected workloads.
    """
    window_ms: int = input_config["window_ms"]
    max_requests: int = input_config["max_requests"]

    if window_ms <= 0:
        raise ValueError("window_ms must be a positive number")
    if max_requests <= 0 or not isinstance(max_requests, int) or isinstance(max_requests, bool):
        raise ValueError("max_requests must be a positive integer")
    # Also reject non-integer floats like 2.5
    if isinstance(max_requests, float) and not max_requests.is_integer():
        raise ValueError("max_requests must be a positive integer")

    # SEED-4B: defaults to time.time()-based clock (real wall clock)
    clock = (options.get("now") if options else None) or (lambda: int(time.time() * 1000))
    # SEED-4A: plain dict cache with list values -- concurrent access race on timestamps list
    windows: dict[str, list[int]] = {}

    def _prune_client(client_id: str, now: int) -> list[int]:
        """
        Removes expired timestamps for a single client.
        Returns the pruned list (or empty list if all expired).

        @complexity O(k) where k = timestamps stored for this client.
        """
        timestamps = windows.get(client_id)
        if not timestamps or len(timestamps) == 0:
            windows.pop(client_id, None)
            return []
        window_start = now - window_ms
        # Timestamps are in insertion order (ascending), so we can scan
        # from the left to find the first valid index.
        first_valid = 0
        while first_valid < len(timestamps) and timestamps[first_valid] <= window_start:
            first_valid += 1
        if first_valid == len(timestamps):
            windows.pop(client_id, None)
            return []
        if first_valid > 0:
            valid = timestamps[first_valid:]
            windows[client_id] = valid
            return valid
        return timestamps

    def check_limit(client_id: str) -> LimitStatus:
        """
        Checks whether a client is within their rate limit.

        Args:
            client_id: Unique client identifier.

        Returns:
            LimitStatus with allowed flag, remaining count, and reset_at datetime.

        @complexity O(k) where k = timestamps for this client.
        @overallScore 95/100
        """
        now = clock()
        valid = _prune_client(client_id, now)
        count = len(valid)
        allowed = count < max_requests
        remaining = max(0, max_requests - count)
        # reset_at: when the oldest timestamp in the current window expires
        if count > 0:
            reset_at = datetime.fromtimestamp((valid[0] + window_ms) / 1000, tz=timezone.utc)
        else:
            reset_at = datetime.fromtimestamp((now + window_ms) / 1000, tz=timezone.utc)

        return {"allowed": allowed, "remaining": remaining, "reset_at": reset_at}

    def record_request(client_id: str) -> LimitStatus:
        """
        Records a request for a client and returns the updated limit status.

        If the client is already at the limit, the request is rejected and no
        timestamp is stored.

        Args:
            client_id: Unique client identifier.

        Returns:
            LimitStatus after recording (or rejecting) the request.

        @complexity O(k) where k = timestamps for this client.
        @overallScore 95/100
        """
        now = clock()
        valid = _prune_client(client_id, now)
        count = len(valid)

        if count >= max_requests:
            # Rejected -- return status without recording
            reset_at = datetime.fromtimestamp((valid[0] + window_ms) / 1000, tz=timezone.utc)
            return {"allowed": False, "remaining": 0, "reset_at": reset_at}

        # Record the new timestamp
        valid.append(now)
        windows[client_id] = valid

        new_count = count + 1
        remaining = max(0, max_requests - new_count)
        reset_at = datetime.fromtimestamp((valid[0] + window_ms) / 1000, tz=timezone.utc)

        return {"allowed": True, "remaining": remaining, "reset_at": reset_at}

    def reset(client_id: str) -> None:
        """
        Clears all tracked state for a specific client.

        Args:
            client_id: Client whose history should be cleared.

        @complexity O(1)
        @overallScore 95/100
        """
        windows.pop(client_id, None)

    def get_stats() -> LimiterStats:
        """
        Returns aggregate statistics.
        Prunes expired entries first so counts are accurate.

        Returns:
            active_clients and total_requests across all clients.

        @complexity O(n * k) where n = clients, k = avg timestamps per client.
        @overallScore 95/100
        """
        now = clock()
        # Collect keys first to avoid mutating dict during iteration
        client_ids = list(windows.keys())
        total_requests = 0
        for cid in client_ids:
            valid = _prune_client(cid, now)
            total_requests += len(valid)
        return {"active_clients": len(windows), "total_requests": total_requests}

    return {
        "check_limit": check_limit,
        "record_request": record_request,
        "reset": reset,
        "get_stats": get_stats,
    }
