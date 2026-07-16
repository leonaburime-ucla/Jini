# Rate Limiter with Sliding Window Cache

Build a rate limiter using a sliding window algorithm in Python.

## Requirements

1. Track requests per client ID using a sliding window of configurable duration (default 60 seconds).
2. Each client gets a configurable max requests per window (default 100).
3. `checkLimit(clientId)` returns: { allowed: boolean, remaining: number, resetAt: Date }.
4. `recordRequest(clientId)` logs a request timestamp and returns the limit status.
5. Expired entries outside the window must be cleaned up to prevent memory growth.
6. Must support a `reset(clientId)` to clear a specific client's history.
7. Must support a `getStats()` returning total active clients and total tracked requests.

## Constraints

- Pure Python, no external dependencies
- Must include tests
- Clock must be injectable for deterministic testing
