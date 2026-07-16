"""Tests for webhook signature verification gateway."""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta

from src.webhook_rotation import (
    DualKeyGraceVerifier,
    EventDispatcher,
    GatewayConfig,
    GatewayHealth,
    KeyRotationManager,
    NonceStore,
    Provider,
    ProviderConfig,
    ProviderRegistry,
    RotationConfig,
    SignatureVerifier,
    SigningKey,
    TenantRegistry,
    VerificationMetrics,
    WebhookGateway,
    constant_time_compare,
    create_gateway,
    PROVIDER_ALGORITHMS,
    SIGNATURE_HEADERS,
    TENANT_HEADERS,
    NONCE_HEADERS,
    TIMESTAMP_HEADERS,
)


def make_key(
    key_id: str = "key-1",
    secret: bytes = b"test-secret-256",
    provider: Provider = Provider.STRIPE,
    activated_at: float = 1000.0,
    is_primary: bool = True,
) -> SigningKey:
    return SigningKey(
        key_id=key_id,
        secret=secret,
        provider=provider,
        activated_at=activated_at,
        is_primary=is_primary,
    )


def make_gateway(
    provider: Provider = Provider.STRIPE,
    primary_secret: bytes = b"primary-secret",
    legacy_secret: bytes | None = None,
    tenants: list[str] | None = None,
    clock: float = 1000.0,
    config: GatewayConfig | None = None,
) -> WebhookGateway:
    primary = make_key(key_id="pk-1", secret=primary_secret, provider=provider)
    legacy = None
    if legacy_secret is not None:
        legacy = make_key(
            key_id="lk-1", secret=legacy_secret, provider=provider, is_primary=False
        )

    rotation = RotationConfig(primary_key=primary, legacy_key=legacy)
    provider_config = ProviderConfig(provider=provider, rotation_config=rotation)

    effective_tenants = tenants or ["tenant-a", "tenant-b"]
    effective_config = config or GatewayConfig()

    return create_gateway(
        providers=[provider_config],
        tenants=effective_tenants,
        config=effective_config,
        clock=lambda: clock,
    )


def sign_payload(payload: dict, secret: bytes, algorithm: str = "sha256") -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    hash_fn = getattr(hashlib, algorithm)
    return hmac.new(secret, raw, hash_fn).hexdigest()


class TestSignatureVerification:
    def test_valid_signature_accepted(self) -> None:
        gateway = make_gateway()
        payload = {"type": "payment_intent.succeeded", "id": "evt_1"}
        sig = sign_payload(payload, b"primary-secret")

        headers = {
            "Stripe-Signature": sig,
            "Stripe-Account": "tenant-a",
            "Stripe-Webhook-Id": "nonce-1",
            "Stripe-Timestamp": "1000.0",
        }
        body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()

        result = gateway.process_webhook(headers, body)
        assert result.valid
        assert result.tenant_id == "tenant-a"

    def test_invalid_signature_rejected(self) -> None:
        gateway = make_gateway()
        payload = {"type": "charge.failed", "id": "evt_2"}
        sig = sign_payload(payload, b"wrong-secret")

        headers = {
            "Stripe-Signature": sig,
            "Stripe-Account": "tenant-a",
            "Stripe-Webhook-Id": "nonce-2",
            "Stripe-Timestamp": "1000.0",
        }
        body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()

        result = gateway.process_webhook(headers, body)
        assert not result.valid
        assert result.error == "signature_mismatch"

    def test_legacy_key_accepted_during_rotation(self) -> None:
        gateway = make_gateway(legacy_secret=b"old-secret")
        payload = {"type": "invoice.paid", "id": "evt_3"}
        sig = sign_payload(payload, b"old-secret")

        headers = {
            "Stripe-Signature": sig,
            "Stripe-Account": "tenant-b",
            "Stripe-Webhook-Id": "nonce-3",
            "Stripe-Timestamp": "1000.0",
        }
        body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()

        result = gateway.process_webhook(headers, body)
        assert result.valid

    def test_unknown_provider_rejected(self) -> None:
        gateway = make_gateway()
        headers = {"Unknown-Header": "value"}
        body = b'{"type": "test"}'

        result = gateway.process_webhook(headers, body)
        assert not result.valid
        assert result.error == "unknown_provider"


class TestReplayProtection:
    def test_duplicate_nonce_rejected(self) -> None:
        gateway = make_gateway()
        payload = {"type": "test", "id": "1"}
        sig = sign_payload(payload, b"primary-secret")
        body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()

        headers = {
            "Stripe-Signature": sig,
            "Stripe-Account": "tenant-a",
            "Stripe-Webhook-Id": "same-nonce",
            "Stripe-Timestamp": "1000.0",
        }

        first = gateway.process_webhook(headers, body)
        assert first.valid

        second = gateway.process_webhook(headers, body)
        assert not second.valid
        assert second.error == "replay_detected"

    def test_expired_timestamp_rejected(self) -> None:
        gateway = make_gateway(clock=1000.0)
        payload = {"type": "test", "id": "2"}
        sig = sign_payload(payload, b"primary-secret")
        body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()

        headers = {
            "Stripe-Signature": sig,
            "Stripe-Account": "tenant-a",
            "Stripe-Webhook-Id": "nonce-ts",
            "Stripe-Timestamp": "500.0",
        }

        result = gateway.process_webhook(headers, body)
        assert not result.valid
        assert result.error == "timestamp_invalid"


class TestTenantRouting:
    def test_routes_to_correct_tenant_from_header(self) -> None:
        gateway = make_gateway()
        payload = {"type": "test", "id": "r1"}
        sig = sign_payload(payload, b"primary-secret")
        body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()

        headers = {
            "Stripe-Signature": sig,
            "Stripe-Account": "tenant-b",
            "Stripe-Webhook-Id": "nonce-route",
            "Stripe-Timestamp": "1000.0",
        }

        result = gateway.process_webhook(headers, body)
        assert result.valid
        assert result.tenant_id == "tenant-b"

    def test_unknown_tenant_rejected(self) -> None:
        gateway = make_gateway()
        payload = {"type": "test", "id": "r2"}
        sig = sign_payload(payload, b"primary-secret")
        body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()

        headers = {
            "Stripe-Signature": sig,
            "Stripe-Account": "unknown-tenant",
            "Stripe-Webhook-Id": "nonce-unk",
            "Stripe-Timestamp": "1000.0",
        }

        result = gateway.process_webhook(headers, body)
        assert not result.valid
        assert result.error == "tenant_not_found"


class TestConstantTimeCompare:
    def test_equal_values_match(self) -> None:
        a = b"deadbeef" * 4
        assert constant_time_compare(a, a)

    def test_different_values_reject(self) -> None:
        a = b"deadbeef" * 4
        b_val = b"cafebabe" * 4
        assert not constant_time_compare(a, b_val)


class TestDualKeyGraceVerifier:
    def test_primary_key_always_accepted(self) -> None:
        primary = make_key(key_id="p", secret=b"pk")
        legacy = make_key(key_id="l", secret=b"lk")
        deadline = datetime.utcnow() + timedelta(hours=24)
        verifier = DualKeyGraceVerifier(primary, legacy, deadline)

        body = b"test payload"
        sig = hmac.new(b"pk", body, hashlib.sha256).digest()
        result = verifier.verify(body, sig, "sha256")
        assert result.valid

    def test_legacy_accepted_within_grace(self) -> None:
        primary = make_key(key_id="p", secret=b"pk")
        legacy = make_key(key_id="l", secret=b"lk")
        deadline = datetime.utcnow() + timedelta(hours=24)
        verifier = DualKeyGraceVerifier(primary, legacy, deadline)

        body = b"test payload"
        sig = hmac.new(b"lk", body, hashlib.sha256).digest()
        result = verifier.verify(body, sig, "sha256")
        assert result.valid

    def test_legacy_rejected_after_grace(self) -> None:
        primary = make_key(key_id="p", secret=b"pk")
        legacy = make_key(key_id="l", secret=b"lk")
        deadline = datetime.utcnow() - timedelta(hours=1)
        verifier = DualKeyGraceVerifier(primary, legacy, deadline)

        body = b"test payload"
        sig = hmac.new(b"lk", body, hashlib.sha256).digest()
        result = verifier.verify(body, sig, "sha256")
        assert not result.valid


class TestKeyRotation:
    def test_rotate_moves_primary_to_legacy(self) -> None:
        primary = make_key(key_id="k1", secret=b"s1")
        rotation = RotationConfig(primary_key=primary)
        config = ProviderConfig(provider=Provider.STRIPE, rotation_config=rotation)

        registry = ProviderRegistry()
        registry.register(config)

        manager = KeyRotationManager(registry, clock=lambda: 2000.0)
        new_key = make_key(key_id="k2", secret=b"s2")
        manager.rotate(Provider.STRIPE, new_key)

        updated = registry.get(Provider.STRIPE)
        assert updated.rotation_config.primary_key.key_id == "k2"
        assert updated.rotation_config.legacy_key.key_id == "k1"

    def test_rotation_history_recorded(self) -> None:
        primary = make_key(key_id="k1", secret=b"s1")
        rotation = RotationConfig(primary_key=primary)
        config = ProviderConfig(provider=Provider.STRIPE, rotation_config=rotation)

        registry = ProviderRegistry()
        registry.register(config)

        manager = KeyRotationManager(registry, clock=lambda: 3000.0)
        manager.rotate(Provider.STRIPE, make_key(key_id="k2", secret=b"s2"))

        history = manager.rotation_history(Provider.STRIPE)
        assert len(history) == 1
        assert history[0]["old_key_id"] == "k1"
        assert history[0]["new_key_id"] == "k2"


class TestMetrics:
    def test_acceptance_rate_calculation(self) -> None:
        metrics = VerificationMetrics()
        metrics.record_accept()
        metrics.record_accept()
        metrics.record_reject("signature")

        assert metrics.acceptance_rate == 2 / 3

    def test_legacy_key_tracking(self) -> None:
        metrics = VerificationMetrics()
        metrics.record_accept(used_legacy=True)
        metrics.record_accept(used_legacy=False)

        assert metrics.legacy_key_accepts == 1


class TestHealthCheck:
    def test_healthy_when_above_threshold(self) -> None:
        gateway = make_gateway()
        health = GatewayHealth(gateway, sla_threshold=0.5)

        payload = {"type": "test"}
        sig = sign_payload(payload, b"primary-secret")
        body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()

        headers = {
            "Stripe-Signature": sig,
            "Stripe-Account": "tenant-a",
            "Stripe-Webhook-Id": "h-nonce",
            "Stripe-Timestamp": "1000.0",
        }
        gateway.process_webhook(headers, body)

        assert health.healthy
