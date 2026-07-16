"""
Multi-channel notification delivery service.

Routes notifications across email, SMS, and push providers with tenant-aware
preference resolution, provider failover, template caching, quiet-hours
enforcement, and deduplication.
"""
from __future__ import annotations

import hashlib
import logging
import random
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Literal, Protocol

logger = logging.getLogger(__name__)

Channel = Literal["email", "sms", "push"]
Severity = Literal["transactional", "marketing", "security"]


@dataclass(frozen=True)
class UserContact:
    user_id: str
    tenant_id: str
    email: str
    phone: str
    push_token: str | None
    timezone: str
    locale: str


@dataclass(frozen=True)
class NotificationRequest:
    notification_id: str
    tenant_id: str
    user_id: str
    channel: Channel
    topic: str
    template_id: str
    template_version: int
    severity: Severity
    payload: dict[str, str]
    locale: str | None = None
    content_sensitivity: str = "standard"


@dataclass(frozen=True)
class DeliveryResult:
    status: Literal["delivered", "suppressed", "deferred", "failed", "duplicate"]
    channel: Channel
    provider: str | None = None
    message_id: str | None = None
    reason: str | None = None


@dataclass(frozen=True)
class ProviderResponse:
    accepted: bool
    message_id: str | None = None
    error_code: str | None = None
    retryable: bool = False


# ---------------------------------------------------------------------------
# Provider client
# ---------------------------------------------------------------------------

class ProviderClient(Protocol):
    @property
    def name(self) -> str: ...
    def deliver(
        self, contact: UserContact, channel: Channel, body: str, idempotency_key: str
    ) -> ProviderResponse: ...


class RetryPolicy:
    """Calculates backoff delays for provider retries."""

    def __init__(
        self,
        max_attempts: int = 3,
        base_delay: float = 0.5,
        max_delay: float = 8.0,
        jitter_factor: float = 0.25,
    ) -> None:
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.jitter_factor = jitter_factor

    def next_delay(self, attempt: int) -> float:
        delay = min(self.base_delay * (2 ** attempt), self.max_delay)
        jitter = delay * self.jitter_factor * random.random()
        return delay + jitter


class ProviderWithRetry:
    """Wraps a provider client with retry logic."""

    def __init__(
        self,
        client: ProviderClient,
        retry_policy: RetryPolicy | None = None,
        sleep_fn: Callable[[float], None] | None = None,
    ) -> None:
        self.client = client
        self.policy = retry_policy or RetryPolicy()
        self._sleep = sleep_fn or time.sleep

    @property
    def name(self) -> str:
        return self.client.name

    def deliver(
        self, contact: UserContact, channel: Channel, body: str, idempotency_key: str
    ) -> ProviderResponse:
        last_error: ProviderResponse | None = None
        for attempt in range(self.policy.max_attempts):
            response = self.client.deliver(contact, channel, body, idempotency_key)
            if response.accepted:
                return response
            last_error = response
            if not response.retryable:
                return response
            if attempt < self.policy.max_attempts - 1:
                self._sleep(self.policy.next_delay(attempt))
        return last_error  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Deduplication store
# ---------------------------------------------------------------------------

class DeduplicationStore:
    """Tracks which notifications have already been processed."""

    def __init__(self) -> None:
        self._seen: dict[str, DeliveryResult] = {}

    def build_key(self, request: NotificationRequest) -> str:
        return f"{request.user_id}:{request.notification_id}"

    def has_been_sent(self, key: str) -> bool:
        return key in self._seen

    def get_prior(self, key: str) -> DeliveryResult | None:
        return self._seen.get(key)

    def record(self, key: str, result: DeliveryResult) -> None:
        self._seen[key] = result


# ---------------------------------------------------------------------------
# Suppression policy
# ---------------------------------------------------------------------------

class SuppressionPolicy:
    """Manages user opt-out preferences per channel and topic."""

    def __init__(self) -> None:
        self._rules: set[tuple[str, str, Channel, str]] = set()

    def add_suppression(
        self, tenant_id: str, user_id: str, channel: Channel, topic: str
    ) -> None:
        self._rules.add((tenant_id, user_id, channel, topic))

    def is_suppressed(
        self, tenant_id: str, user_id: str, channel: Channel, topic: str
    ) -> bool:
        return (tenant_id, user_id, channel, topic) in self._rules


# ---------------------------------------------------------------------------
# Quiet hours
# ---------------------------------------------------------------------------

@dataclass
class QuietHoursConfig:
    start_hour: int = 22
    end_hour: int = 8


class QuietHoursPolicy:
    """Determines whether notifications should be deferred based on time."""

    def __init__(
        self,
        config: QuietHoursConfig | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.config = config or QuietHoursConfig()
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    def is_in_quiet_hours(self, contact: UserContact) -> bool:
        now = self._clock()
        current_hour = now.hour
        start = self.config.start_hour
        end = self.config.end_hour
        if start > end:
            return current_hour >= start or current_hour < end
        return start <= current_hour < end


# ---------------------------------------------------------------------------
# Template cache
# ---------------------------------------------------------------------------

class TemplateCache:
    """Caches rendered template content for performance."""

    def __init__(self) -> None:
        self._cache: dict[str, str] = {}
        self._versions: dict[str, int] = {}

    def get_rendered(
        self,
        template_id: str,
        template_version: int,
        locale: str,
        content_sensitivity: str,
        payload: dict[str, str],
    ) -> str:
        cache_key = template_id
        if cache_key in self._cache and self._versions.get(cache_key) == template_version:
            return self._cache[cache_key].format_map(payload)

        base_content = self._build_template(template_id, locale, content_sensitivity)
        self._cache[cache_key] = base_content
        self._versions[cache_key] = template_version
        return base_content.format_map(payload)

    def invalidate(self, template_id: str, new_version: int) -> None:
        cache_key = template_id
        current = self._versions.get(cache_key)
        if current is not None and current < new_version:
            self._cache.pop(cache_key, None)
            self._versions.pop(cache_key, None)

    def _build_template(
        self, template_id: str, locale: str, content_sensitivity: str
    ) -> str:
        sensitivity_label = f"[{content_sensitivity.upper()}] " if content_sensitivity != "standard" else ""
        return f"{sensitivity_label}[{locale}] {template_id}: {{body}}"


# ---------------------------------------------------------------------------
# Contact resolver
# ---------------------------------------------------------------------------

class ContactStore:
    """Resolves user contact information."""

    def __init__(self) -> None:
        self._contacts: dict[tuple[str, str], UserContact] = {}

    def register(self, contact: UserContact) -> None:
        self._contacts[(contact.tenant_id, contact.user_id)] = contact

    def resolve(self, tenant_id: str, user_id: str) -> UserContact | None:
        return self._contacts.get((tenant_id, user_id))


# ---------------------------------------------------------------------------
# Delivery metrics
# ---------------------------------------------------------------------------

class DeliveryMetrics:
    """Collects delivery outcome statistics."""

    def __init__(self) -> None:
        self.total_dispatched: int = 0
        self.total_delivered: int = 0
        self.total_suppressed: int = 0
        self.total_deferred: int = 0
        self.total_failed: int = 0
        self.total_duplicates: int = 0
        self._latencies: list[float] = []

    def record_outcome(self, result: DeliveryResult, latency_ms: float) -> None:
        self.total_dispatched += 1
        self._latencies.append(latency_ms)
        if result.status == "delivered":
            self.total_delivered += 1
        elif result.status == "suppressed":
            self.total_suppressed += 1
        elif result.status == "deferred":
            self.total_deferred += 1
        elif result.status == "failed":
            self.total_failed += 1
        elif result.status == "duplicate":
            self.total_duplicates += 1

    @property
    def p95_latency_ms(self) -> float:
        if not self._latencies:
            return 0.0
        sorted_l = sorted(self._latencies)
        idx = int(len(sorted_l) * 0.95)
        return sorted_l[min(idx, len(sorted_l) - 1)]

    @property
    def delivery_rate(self) -> float:
        if self.total_dispatched == 0:
            return 0.0
        return self.total_delivered / self.total_dispatched


# ---------------------------------------------------------------------------
# Fallback configuration
# ---------------------------------------------------------------------------

@dataclass
class ChannelConfig:
    primary_provider: str
    fallback_channels: list[Channel] = field(default_factory=list)
    max_retries: int = 3


DEFAULT_CHANNEL_CONFIG: dict[Channel, ChannelConfig] = {
    "email": ChannelConfig(
        primary_provider="sendgrid",
        fallback_channels=["sms"],
        max_retries=3,
    ),
    "sms": ChannelConfig(
        primary_provider="twilio",
        fallback_channels=[],
        max_retries=2,
    ),
    "push": ChannelConfig(
        primary_provider="firebase",
        fallback_channels=["sms", "email"],
        max_retries=2,
    ),
}


# ---------------------------------------------------------------------------
# Notification dispatcher
# ---------------------------------------------------------------------------

class NotificationDispatcher:
    """
    Orchestrates notification delivery with provider failover, deduplication,
    suppression enforcement, quiet-hours deferral, and audit logging.
    """

    def __init__(
        self,
        providers: dict[Channel, ProviderWithRetry],
        contacts: ContactStore,
        suppression: SuppressionPolicy,
        dedupe: DeduplicationStore,
        template_cache: TemplateCache,
        quiet_hours: QuietHoursPolicy,
        metrics: DeliveryMetrics,
        channel_config: dict[Channel, ChannelConfig] | None = None,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self.providers = providers
        self.contacts = contacts
        self.suppression = suppression
        self.dedupe = dedupe
        self.template_cache = template_cache
        self.quiet_hours = quiet_hours
        self.metrics = metrics
        self.channel_config = channel_config or DEFAULT_CHANNEL_CONFIG
        self._clock = clock or time.time
        self.audit_log: list[dict[str, object]] = []

    def dispatch(self, request: NotificationRequest) -> DeliveryResult:
        start = self._clock()

        dedupe_key = self.dedupe.build_key(request)
        prior = self.dedupe.get_prior(dedupe_key)
        if prior is not None:
            result = DeliveryResult(
                status="duplicate",
                channel=prior.channel,
                provider=prior.provider,
                message_id=prior.message_id,
                reason="previously_processed",
            )
            self._record_audit("duplicate", request, result)
            self.metrics.record_outcome(result, (self._clock() - start) * 1000)
            return result

        contact = self.contacts.resolve(request.tenant_id, request.user_id)
        if contact is None:
            result = DeliveryResult(
                status="failed", channel=request.channel, reason="contact_not_found"
            )
            self._record_audit("contact_missing", request, result)
            self.metrics.record_outcome(result, (self._clock() - start) * 1000)
            return result

        if self.suppression.is_suppressed(
            request.tenant_id, request.user_id, request.channel, request.topic
        ):
            result = DeliveryResult(
                status="suppressed", channel=request.channel, reason="user_preference"
            )
            self.dedupe.record(dedupe_key, result)
            self._record_audit("suppressed", request, result)
            self.metrics.record_outcome(result, (self._clock() - start) * 1000)
            return result

        if request.severity != "security" and self.quiet_hours.is_in_quiet_hours(contact):
            result = DeliveryResult(
                status="deferred", channel=request.channel, reason="quiet_hours"
            )
            self._record_audit("deferred", request, result)
            self.metrics.record_outcome(result, (self._clock() - start) * 1000)
            return result

        locale = request.locale or contact.locale
        body = self.template_cache.get_rendered(
            request.template_id,
            request.template_version,
            locale,
            request.content_sensitivity,
            request.payload,
        )

        config = self.channel_config[request.channel]
        channels_to_try: list[Channel] = [request.channel, *config.fallback_channels]

        result = self._attempt_delivery(request, contact, body, channels_to_try, dedupe_key)
        self.metrics.record_outcome(result, (self._clock() - start) * 1000)
        return result

    def _attempt_delivery(
        self,
        request: NotificationRequest,
        contact: UserContact,
        body: str,
        channels: list[Channel],
        dedupe_key: str,
    ) -> DeliveryResult:
        last_error: str | None = None

        for channel in channels:
            provider = self.providers.get(channel)
            if provider is None:
                continue

            response = self._attempt_send(provider, contact, channel, body, dedupe_key)

            if response.accepted:
                result = DeliveryResult(
                    status="delivered",
                    channel=channel,
                    provider=provider.name,
                    message_id=response.message_id,
                )
                self.dedupe.record(dedupe_key, result)
                self._record_audit("delivered", request, result)
                return result

            last_error = response.error_code
            if channel != channels[-1]:
                logger.info(
                    "Provider %s failed for channel %s, trying fallback",
                    provider.name,
                    channel,
                )

        result = DeliveryResult(
            status="failed",
            channel=request.channel,
            reason=last_error or "all_providers_exhausted",
        )
        self._log_failure(request, contact, result)
        self._record_audit("failed", request, result)
        return result

    def _attempt_send(
        self,
        provider: ProviderWithRetry,
        contact: UserContact,
        channel: Channel,
        body: str,
        idempotency_key: str,
    ) -> ProviderResponse:
        return provider.deliver(contact, channel, body, idempotency_key)

    def _log_failure(
        self,
        request: NotificationRequest,
        contact: UserContact,
        result: DeliveryResult,
    ) -> None:
        logger.error(
            "Notification delivery failed: notification_id=%s tenant=%s "
            "user=%s email=%s phone=%s channel=%s reason=%s",
            request.notification_id,
            request.tenant_id,
            request.user_id,
            contact.email,
            contact.phone,
            result.channel,
            result.reason,
        )

    def _record_audit(
        self,
        event: str,
        request: NotificationRequest,
        result: DeliveryResult,
    ) -> None:
        self.audit_log.append({
            "event": event,
            "notification_id": request.notification_id,
            "tenant_id": request.tenant_id,
            "user_id": request.user_id,
            "channel": result.channel,
            "provider": result.provider,
            "status": result.status,
            "reason": result.reason,
            "timestamp": self._clock(),
        })


# ---------------------------------------------------------------------------
# In-memory provider implementations for testing
# ---------------------------------------------------------------------------

class InMemoryProvider:
    """Simulated provider for unit tests."""

    def __init__(
        self,
        name: str,
        *,
        fail_first_n: int = 0,
        timeout_on_first: bool = False,
    ) -> None:
        self._name = name
        self._fail_first_n = fail_first_n
        self._timeout_on_first = timeout_on_first
        self._call_count = 0
        self.deliveries: list[tuple[str, Channel, str, str]] = []

    @property
    def name(self) -> str:
        return self._name

    def deliver(
        self, contact: UserContact, channel: Channel, body: str, idempotency_key: str
    ) -> ProviderResponse:
        self._call_count += 1
        self.deliveries.append((contact.user_id, channel, body, idempotency_key))

        if self._timeout_on_first and self._call_count == 1:
            return ProviderResponse(
                accepted=False,
                message_id=f"{self._name}-timeout-{self._call_count}",
                error_code="timeout",
                retryable=True,
            )

        if self._call_count <= self._fail_first_n:
            return ProviderResponse(
                accepted=False,
                error_code="transient_failure",
                retryable=True,
            )

        msg_id = hashlib.sha256(
            f"{self._name}:{idempotency_key}:{self._call_count}".encode()
        ).hexdigest()[:12]
        return ProviderResponse(accepted=True, message_id=f"{self._name}-{msg_id}")


# ---------------------------------------------------------------------------
# Batch dispatcher
# ---------------------------------------------------------------------------

class BatchDispatcher:
    """Processes a batch of notification requests."""

    def __init__(self, dispatcher: NotificationDispatcher) -> None:
        self._dispatcher = dispatcher
        self.results: list[tuple[str, DeliveryResult]] = []

    def process_batch(self, requests: list[NotificationRequest]) -> list[DeliveryResult]:
        results: list[DeliveryResult] = []
        for request in requests:
            result = self._dispatcher.dispatch(request)
            self.results.append((request.notification_id, result))
            results.append(result)
        return results

    @property
    def success_count(self) -> int:
        return sum(1 for _, r in self.results if r.status == "delivered")

    @property
    def failure_count(self) -> int:
        return sum(1 for _, r in self.results if r.status == "failed")


# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------

class PerTenantRateLimiter:
    """Enforces per-tenant notification rate limits."""

    def __init__(
        self,
        max_per_minute: int = 100,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self.max_per_minute = max_per_minute
        self._clock = clock or time.time
        self._windows: dict[str, list[float]] = {}

    def is_allowed(self, tenant_id: str) -> bool:
        now = self._clock()
        window = self._windows.setdefault(tenant_id, [])
        cutoff = now - 60.0
        self._windows[tenant_id] = [t for t in window if t > cutoff]
        if len(self._windows[tenant_id]) >= self.max_per_minute:
            return False
        self._windows[tenant_id].append(now)
        return True

    def current_usage(self, tenant_id: str) -> int:
        now = self._clock()
        window = self._windows.get(tenant_id, [])
        cutoff = now - 60.0
        return sum(1 for t in window if t > cutoff)


# ---------------------------------------------------------------------------
# Notification router (top-level entry point)
# ---------------------------------------------------------------------------

class NotificationRouter:
    """
    Top-level entry point that combines rate limiting with dispatch.
    Used by the API handler to process incoming notification requests.
    """

    def __init__(
        self,
        dispatcher: NotificationDispatcher,
        rate_limiter: PerTenantRateLimiter,
    ) -> None:
        self.dispatcher = dispatcher
        self.rate_limiter = rate_limiter
        self._deferred_queue: list[NotificationRequest] = []

    def route(self, request: NotificationRequest) -> DeliveryResult:
        if not self.rate_limiter.is_allowed(request.tenant_id):
            return DeliveryResult(
                status="deferred",
                channel=request.channel,
                reason="rate_limited",
            )
        return self.dispatcher.dispatch(request)

    def enqueue_deferred(self, request: NotificationRequest) -> None:
        self._deferred_queue.append(request)

    def flush_deferred(self) -> list[DeliveryResult]:
        results: list[DeliveryResult] = []
        remaining: list[NotificationRequest] = []
        for request in self._deferred_queue:
            if self.rate_limiter.is_allowed(request.tenant_id):
                results.append(self.dispatcher.dispatch(request))
            else:
                remaining.append(request)
        self._deferred_queue = remaining
        return results

    @property
    def deferred_count(self) -> int:
        return len(self._deferred_queue)
