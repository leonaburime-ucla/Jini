"""Tests for the notification delivery service."""
from __future__ import annotations

from datetime import datetime, timezone

from src.notification_service import (
    BatchDispatcher,
    ChannelConfig,
    ContactStore,
    DeduplicationStore,
    DeliveryMetrics,
    InMemoryProvider,
    NotificationDispatcher,
    NotificationRequest,
    NotificationRouter,
    PerTenantRateLimiter,
    ProviderWithRetry,
    QuietHoursConfig,
    QuietHoursPolicy,
    RetryPolicy,
    SuppressionPolicy,
    TemplateCache,
    UserContact,
)


def make_contact(**overrides: object) -> UserContact:
    defaults = {
        "user_id": "user-1",
        "tenant_id": "tenant-a",
        "email": "user@example.com",
        "phone": "+15551234567",
        "push_token": "push-tok-abc",
        "timezone": "America/New_York",
        "locale": "en-US",
    }
    defaults.update(overrides)
    return UserContact(**defaults)


def make_request(**overrides: object) -> NotificationRequest:
    defaults = {
        "notification_id": "notif-001",
        "tenant_id": "tenant-a",
        "user_id": "user-1",
        "channel": "email",
        "topic": "order_updates",
        "template_id": "order-shipped",
        "template_version": 1,
        "severity": "transactional",
        "payload": {"body": "Your order has shipped."},
        "locale": "en-US",
        "content_sensitivity": "standard",
    }
    defaults.update(overrides)
    return NotificationRequest(**defaults)


def make_dispatcher(
    email_provider: InMemoryProvider | None = None,
    sms_provider: InMemoryProvider | None = None,
    push_provider: InMemoryProvider | None = None,
    clock: object | None = None,
    quiet_clock: object | None = None,
) -> NotificationDispatcher:
    ep = email_provider or InMemoryProvider("sendgrid")
    sp = sms_provider or InMemoryProvider("twilio")
    pp = push_provider or InMemoryProvider("firebase")

    contacts = ContactStore()
    contacts.register(make_contact())

    no_sleep = lambda _: None
    providers = {
        "email": ProviderWithRetry(ep, RetryPolicy(max_attempts=3), sleep_fn=no_sleep),
        "sms": ProviderWithRetry(sp, RetryPolicy(max_attempts=2), sleep_fn=no_sleep),
        "push": ProviderWithRetry(pp, RetryPolicy(max_attempts=2), sleep_fn=no_sleep),
    }

    qh_clock = quiet_clock or (lambda: datetime(2024, 6, 15, 14, 0, tzinfo=timezone.utc))

    return NotificationDispatcher(
        providers=providers,
        contacts=contacts,
        suppression=SuppressionPolicy(),
        dedupe=DeduplicationStore(),
        template_cache=TemplateCache(),
        quiet_hours=QuietHoursPolicy(clock=qh_clock),
        metrics=DeliveryMetrics(),
        clock=clock or (lambda: 1000.0),
    )


class TestBasicDelivery:
    def test_delivers_email_notification(self) -> None:
        dispatcher = make_dispatcher()
        result = dispatcher.dispatch(make_request())

        assert result.status == "delivered"
        assert result.channel == "email"
        assert result.provider == "sendgrid"
        assert result.message_id is not None

    def test_delivers_sms_notification(self) -> None:
        dispatcher = make_dispatcher()
        result = dispatcher.dispatch(make_request(channel="sms"))

        assert result.status == "delivered"
        assert result.channel == "sms"

    def test_delivers_push_notification(self) -> None:
        dispatcher = make_dispatcher()
        result = dispatcher.dispatch(make_request(channel="push"))

        assert result.status == "delivered"
        assert result.channel == "push"

    def test_returns_failed_for_unknown_contact(self) -> None:
        dispatcher = make_dispatcher()
        result = dispatcher.dispatch(make_request(user_id="unknown-user"))

        assert result.status == "failed"
        assert result.reason == "contact_not_found"


class TestProviderFailover:
    def test_falls_back_to_sms_when_email_fails(self) -> None:
        email = InMemoryProvider("sendgrid", fail_first_n=10)
        dispatcher = make_dispatcher(email_provider=email)

        result = dispatcher.dispatch(make_request())

        assert result.status == "delivered"
        assert result.channel == "sms"
        assert result.provider == "twilio"

    def test_retries_transient_failures_before_fallback(self) -> None:
        email = InMemoryProvider("sendgrid", fail_first_n=2)
        dispatcher = make_dispatcher(email_provider=email)

        result = dispatcher.dispatch(make_request())

        assert result.status == "delivered"
        assert result.channel == "email"

    def test_timeout_triggers_fallback(self) -> None:
        email = InMemoryProvider("sendgrid", timeout_on_first=True)
        dispatcher = make_dispatcher(email_provider=email)

        result = dispatcher.dispatch(make_request())

        assert result.status == "delivered"


class TestDeduplication:
    def test_duplicate_returns_prior_result(self) -> None:
        dispatcher = make_dispatcher()
        request = make_request()

        first = dispatcher.dispatch(request)
        second = dispatcher.dispatch(request)

        assert first.status == "delivered"
        assert second.status == "duplicate"
        assert second.message_id == first.message_id

    def test_different_notifications_not_deduplicated(self) -> None:
        dispatcher = make_dispatcher()

        r1 = dispatcher.dispatch(make_request(notification_id="n1"))
        r2 = dispatcher.dispatch(make_request(notification_id="n2"))

        assert r1.status == "delivered"
        assert r2.status == "delivered"


class TestSuppression:
    def test_suppresses_when_user_opted_out(self) -> None:
        dispatcher = make_dispatcher()
        dispatcher.suppression.add_suppression(
            "tenant-a", "user-1", "email", "order_updates"
        )

        result = dispatcher.dispatch(make_request())

        assert result.status == "suppressed"
        assert result.reason == "user_preference"

    def test_allows_delivery_for_unsuppressed_topic(self) -> None:
        dispatcher = make_dispatcher()
        dispatcher.suppression.add_suppression(
            "tenant-a", "user-1", "email", "marketing"
        )

        result = dispatcher.dispatch(make_request(topic="order_updates"))

        assert result.status == "delivered"


class TestQuietHours:
    def test_defers_during_quiet_hours(self) -> None:
        late_clock = lambda: datetime(2024, 6, 15, 23, 30, tzinfo=timezone.utc)
        dispatcher = make_dispatcher(quiet_clock=late_clock)

        result = dispatcher.dispatch(make_request())

        assert result.status == "deferred"
        assert result.reason == "quiet_hours"

    def test_delivers_outside_quiet_hours(self) -> None:
        afternoon_clock = lambda: datetime(2024, 6, 15, 14, 0, tzinfo=timezone.utc)
        dispatcher = make_dispatcher(quiet_clock=afternoon_clock)

        result = dispatcher.dispatch(make_request())

        assert result.status == "delivered"

    def test_security_notifications_bypass_quiet_hours(self) -> None:
        late_clock = lambda: datetime(2024, 6, 15, 23, 30, tzinfo=timezone.utc)
        dispatcher = make_dispatcher(quiet_clock=late_clock)

        result = dispatcher.dispatch(make_request(severity="security"))

        assert result.status == "delivered"


class TestTemplateRendering:
    def test_renders_template_with_payload(self) -> None:
        dispatcher = make_dispatcher()
        result = dispatcher.dispatch(
            make_request(payload={"body": "Package delivered"})
        )

        assert result.status == "delivered"

    def test_cache_returns_consistent_results(self) -> None:
        cache = TemplateCache()
        first = cache.get_rendered("tpl-1", 1, "en-US", "standard", {"body": "hello"})
        second = cache.get_rendered("tpl-1", 1, "en-US", "standard", {"body": "world"})

        assert "hello" in first
        assert "world" in second

    def test_cache_invalidation_on_version_bump(self) -> None:
        cache = TemplateCache()
        cache.get_rendered("tpl-1", 1, "en-US", "standard", {"body": "v1"})
        cache.invalidate("tpl-1", 2)
        result = cache.get_rendered("tpl-1", 2, "en-US", "standard", {"body": "v2"})

        assert "v2" in result


class TestAuditLog:
    def test_records_delivery_event(self) -> None:
        dispatcher = make_dispatcher()
        dispatcher.dispatch(make_request())

        assert len(dispatcher.audit_log) == 1
        assert dispatcher.audit_log[0]["event"] == "delivered"
        assert dispatcher.audit_log[0]["notification_id"] == "notif-001"

    def test_records_suppression_event(self) -> None:
        dispatcher = make_dispatcher()
        dispatcher.suppression.add_suppression(
            "tenant-a", "user-1", "email", "order_updates"
        )
        dispatcher.dispatch(make_request())

        assert dispatcher.audit_log[0]["event"] == "suppressed"


class TestRateLimiter:
    def test_allows_within_limit(self) -> None:
        t = 0.0
        limiter = PerTenantRateLimiter(max_per_minute=5, clock=lambda: t)

        for _ in range(5):
            assert limiter.is_allowed("tenant-a")

    def test_blocks_over_limit(self) -> None:
        t = 0.0
        limiter = PerTenantRateLimiter(max_per_minute=3, clock=lambda: t)

        for _ in range(3):
            limiter.is_allowed("tenant-a")

        assert not limiter.is_allowed("tenant-a")


class TestBatchDispatcher:
    def test_processes_batch(self) -> None:
        dispatcher = make_dispatcher()
        batch = BatchDispatcher(dispatcher)

        requests = [
            make_request(notification_id=f"batch-{i}") for i in range(5)
        ]
        results = batch.process_batch(requests)

        assert len(results) == 5
        assert batch.success_count == 5

    def test_counts_failures(self) -> None:
        email = InMemoryProvider("sendgrid", fail_first_n=100)
        sms = InMemoryProvider("twilio", fail_first_n=100)
        dispatcher = make_dispatcher(email_provider=email, sms_provider=sms)
        batch = BatchDispatcher(dispatcher)

        results = batch.process_batch([make_request()])

        assert batch.failure_count == 1


class TestNotificationRouter:
    def test_routes_within_rate_limit(self) -> None:
        dispatcher = make_dispatcher()
        router = NotificationRouter(
            dispatcher=dispatcher,
            rate_limiter=PerTenantRateLimiter(max_per_minute=100),
        )

        result = router.route(make_request())
        assert result.status == "delivered"

    def test_defers_when_rate_limited(self) -> None:
        t = 0.0
        dispatcher = make_dispatcher()
        router = NotificationRouter(
            dispatcher=dispatcher,
            rate_limiter=PerTenantRateLimiter(max_per_minute=1, clock=lambda: t),
        )

        router.route(make_request(notification_id="n1"))
        result = router.route(make_request(notification_id="n2"))

        assert result.status == "deferred"
        assert result.reason == "rate_limited"
