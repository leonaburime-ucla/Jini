"""
Multi-tenant webhook signature verification gateway.

Processes inbound webhooks from Stripe, GitHub, and custom providers.
Supports zero-downtime key rotation with dual-key verification during
grace windows. Replay protection via nonce deduplication and timestamp
bounds checking.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable


class Provider(Enum):
    STRIPE = "stripe"
    GITHUB = "github"
    CUSTOM = "custom"


PROVIDER_ALGORITHMS: dict[Provider, str] = {
    Provider.STRIPE: "sha256",
    Provider.GITHUB: "sha1",
    Provider.CUSTOM: "sha512",
}

SIGNATURE_HEADERS: dict[Provider, str] = {
    Provider.STRIPE: "Stripe-Signature",
    Provider.GITHUB: "X-Hub-Signature",
    Provider.CUSTOM: "X-Signature",
}

TIMESTAMP_HEADERS: dict[Provider, str] = {
    Provider.STRIPE: "Stripe-Timestamp",
    Provider.GITHUB: "X-GitHub-Delivery-Timestamp",
    Provider.CUSTOM: "X-Timestamp",
}

NONCE_HEADERS: dict[Provider, str] = {
    Provider.STRIPE: "Stripe-Webhook-Id",
    Provider.GITHUB: "X-GitHub-Delivery",
    Provider.CUSTOM: "X-Nonce",
}

TENANT_HEADERS: dict[Provider, str] = {
    Provider.STRIPE: "Stripe-Account",
    Provider.GITHUB: "X-GitHub-Installation-ID",
    Provider.CUSTOM: "X-Tenant-ID",
}


@dataclass
class SigningKey:
    key_id: str
    secret: bytes
    provider: Provider
    activated_at: float
    is_primary: bool = True


@dataclass
class RotationConfig:
    primary_key: SigningKey
    legacy_key: SigningKey | None = None
    grace_period_seconds: float = 86400.0


@dataclass
class GatewayConfig:
    timestamp_tolerance: float = 300.0
    nonce_ttl_seconds: float = 300.0
    max_body_bytes: int = 2 * 1024 * 1024
    require_timestamp: bool = True
    require_nonce: bool = True


@dataclass
class VerificationResult:
    valid: bool
    provider: Provider | None = None
    tenant_id: str | None = None
    key_id: str | None = None
    error: str | None = None


@dataclass
class WebhookEvent:
    event_id: str
    provider: Provider
    tenant_id: str
    event_type: str
    payload: dict[str, Any]
    received_at: float
    verified_with_key: str


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

class VerificationMetrics:
    def __init__(self) -> None:
        self.total_requests: int = 0
        self.accepted: int = 0
        self.rejected: int = 0
        self.replay_rejections: int = 0
        self.timestamp_rejections: int = 0
        self.legacy_key_accepts: int = 0
        self.routing_failures: int = 0

    def record_accept(self, used_legacy: bool = False) -> None:
        self.total_requests += 1
        self.accepted += 1
        if used_legacy:
            self.legacy_key_accepts += 1

    def record_reject(self, reason: str) -> None:
        self.total_requests += 1
        self.rejected += 1
        if reason == "replay":
            self.replay_rejections += 1
        elif reason == "timestamp":
            self.timestamp_rejections += 1
        elif reason == "routing":
            self.routing_failures += 1

    @property
    def acceptance_rate(self) -> float:
        if self.total_requests == 0:
            return 1.0
        return self.accepted / self.total_requests


# ---------------------------------------------------------------------------
# Constant-time comparison
# ---------------------------------------------------------------------------

def constant_time_compare(a: bytes, b: bytes) -> bool:
    return hmac.compare_digest(a, b)


# ---------------------------------------------------------------------------
# Nonce store
# ---------------------------------------------------------------------------

class NonceStore:
    def __init__(
        self,
        ttl_seconds: float = 300.0,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self._seen: dict[str, float] = {}
        self._ttl = ttl_seconds
        self._clock = clock or time.time

    def check_and_store(self, nonce: str) -> bool:
        self._evict_expired()
        key = nonce
        if key in self._seen:
            return False
        self._seen[key] = self._clock()
        return True

    def _evict_expired(self) -> None:
        now = self._clock()
        cutoff = now - self._ttl
        expired = [k for k, ts in self._seen.items() if ts < cutoff]
        for k in expired:
            del self._seen[k]

    @property
    def size(self) -> int:
        return len(self._seen)


# ---------------------------------------------------------------------------
# Signature verifier
# ---------------------------------------------------------------------------

class SignatureVerifier:
    def __init__(self, rotation_config: RotationConfig) -> None:
        self._config = rotation_config

    def verify(
        self,
        payload: dict[str, Any],
        provided_signature: bytes,
        algorithm: str,
    ) -> VerificationResult:
        primary_sig = self._compute_signature(
            payload, self._config.primary_key.secret, algorithm
        )
        if constant_time_compare(primary_sig, provided_signature):
            return VerificationResult(
                valid=True,
                provider=self._config.primary_key.provider,
                key_id=self._config.primary_key.key_id,
            )

        if self._config.legacy_key is not None:
            legacy_sig = self._compute_signature(
                payload, self._config.legacy_key.secret, algorithm
            )
            if constant_time_compare(legacy_sig, provided_signature):
                return VerificationResult(
                    valid=True,
                    provider=self._config.legacy_key.provider,
                    key_id=self._config.legacy_key.key_id,
                )

        return VerificationResult(valid=False, error="signature_mismatch")

    def _compute_signature(
        self,
        payload: dict[str, Any],
        secret: bytes,
        algorithm: str,
    ) -> bytes:
        canonical = json.dumps(
            payload, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
        hash_fn = getattr(hashlib, algorithm)
        return hmac.new(secret, canonical, hash_fn).digest()


# ---------------------------------------------------------------------------
# Dual-key grace verifier
# ---------------------------------------------------------------------------

class DualKeyGraceVerifier:
    def __init__(
        self,
        primary_key: SigningKey,
        legacy_key: SigningKey,
        grace_deadline: datetime,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._primary = primary_key
        self._legacy = legacy_key
        self._grace_deadline = grace_deadline
        self._clock = clock or datetime.utcnow

    def verify(
        self,
        raw_body: bytes,
        provided_signature: bytes,
        algorithm: str,
    ) -> VerificationResult:
        hash_fn = getattr(hashlib, algorithm)

        primary_sig = hmac.new(
            self._primary.secret, raw_body, hash_fn
        ).digest()
        if constant_time_compare(primary_sig, provided_signature):
            return VerificationResult(
                valid=True,
                provider=self._primary.provider,
                key_id=self._primary.key_id,
            )

        now = self._clock()
        if now <= self._grace_deadline:
            legacy_sig = hmac.new(
                self._legacy.secret, raw_body, hash_fn
            ).digest()
            if constant_time_compare(legacy_sig, provided_signature):
                return VerificationResult(
                    valid=True,
                    provider=self._legacy.provider,
                    key_id=self._legacy.key_id,
                )

        return VerificationResult(valid=False, error="signature_mismatch")


# ---------------------------------------------------------------------------
# Tenant registry
# ---------------------------------------------------------------------------

class TenantRegistry:
    def __init__(self) -> None:
        self._tenants: dict[str, dict[str, Any]] = {}

    def register(self, tenant_id: str, config: dict[str, Any] | None = None) -> None:
        self._tenants[tenant_id] = config or {}

    def exists(self, tenant_id: str) -> bool:
        return tenant_id in self._tenants

    def get_config(self, tenant_id: str) -> dict[str, Any] | None:
        return self._tenants.get(tenant_id)


# ---------------------------------------------------------------------------
# Event dispatcher
# ---------------------------------------------------------------------------

class EventDispatcher:
    def __init__(self) -> None:
        self.dispatched: list[WebhookEvent] = []
        self._queues: dict[str, list[WebhookEvent]] = {}

    def dispatch(self, event: WebhookEvent) -> None:
        self.dispatched.append(event)
        queue = self._queues.setdefault(event.tenant_id, [])
        queue.append(event)

    def get_tenant_events(self, tenant_id: str) -> list[WebhookEvent]:
        return self._queues.get(tenant_id, [])


# ---------------------------------------------------------------------------
# Provider registry
# ---------------------------------------------------------------------------

@dataclass
class ProviderConfig:
    provider: Provider
    rotation_config: RotationConfig
    signature_prefix: str = ""


class ProviderRegistry:
    def __init__(self) -> None:
        self._configs: dict[Provider, ProviderConfig] = {}

    def register(self, config: ProviderConfig) -> None:
        self._configs[config.provider] = config

    def get(self, provider: Provider) -> ProviderConfig | None:
        return self._configs.get(provider)

    def resolve_provider(self, headers: dict[str, str | list[str]]) -> Provider | None:
        for provider, header_name in SIGNATURE_HEADERS.items():
            if header_name in headers:
                return provider
        return None


# ---------------------------------------------------------------------------
# Gateway
# ---------------------------------------------------------------------------

class WebhookGateway:
    def __init__(
        self,
        provider_registry: ProviderRegistry,
        tenant_registry: TenantRegistry,
        nonce_store: NonceStore,
        dispatcher: EventDispatcher,
        config: GatewayConfig | None = None,
        metrics: VerificationMetrics | None = None,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self._providers = provider_registry
        self._tenants = tenant_registry
        self._nonces = nonce_store
        self._dispatcher = dispatcher
        self.config = config or GatewayConfig()
        self.metrics = metrics or VerificationMetrics()
        self._clock = clock or time.time

    def process_webhook(
        self,
        headers: dict[str, str | list[str]],
        raw_body: bytes,
    ) -> VerificationResult:
        if len(raw_body) > self.config.max_body_bytes:
            self.metrics.record_reject("size")
            return VerificationResult(valid=False, error="payload_too_large")

        provider = self._providers.resolve_provider(headers)
        if provider is None:
            self.metrics.record_reject("provider")
            return VerificationResult(valid=False, error="unknown_provider")

        provider_config = self._providers.get(provider)
        if provider_config is None:
            self.metrics.record_reject("provider")
            return VerificationResult(valid=False, error="provider_not_configured")

        try:
            payload = json.loads(raw_body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.metrics.record_reject("parse")
            return VerificationResult(valid=False, error="invalid_payload")

        nonce = self._extract_nonce(headers, provider)
        if self.config.require_nonce and nonce:
            if not self._nonces.check_and_store(nonce):
                self.metrics.record_reject("replay")
                return VerificationResult(valid=False, error="replay_detected")

        if self.config.require_timestamp:
            if not self._check_timestamp(headers, provider):
                self.metrics.record_reject("timestamp")
                return VerificationResult(valid=False, error="timestamp_invalid")

        signature = self._extract_signature(headers, provider)
        if signature is None:
            self.metrics.record_reject("signature")
            return VerificationResult(valid=False, error="missing_signature")

        algorithm = PROVIDER_ALGORITHMS[provider]
        verifier = SignatureVerifier(provider_config.rotation_config)
        result = verifier.verify(payload, signature, algorithm)

        if not result.valid:
            self.metrics.record_reject("signature")
            return result

        tenant_id = self._resolve_tenant(headers, provider, payload)
        if tenant_id is None or not self._tenants.exists(tenant_id):
            self.metrics.record_reject("routing")
            return VerificationResult(valid=False, error="tenant_not_found")

        used_legacy = (
            result.key_id is not None
            and provider_config.rotation_config.legacy_key is not None
            and result.key_id == provider_config.rotation_config.legacy_key.key_id
        )
        self.metrics.record_accept(used_legacy=used_legacy)

        event = WebhookEvent(
            event_id=nonce or f"evt_{int(self._clock() * 1000)}",
            provider=provider,
            tenant_id=tenant_id,
            event_type=payload.get("type", payload.get("action", "unknown")),
            payload=payload,
            received_at=self._clock(),
            verified_with_key=result.key_id or "unknown",
        )
        self._dispatcher.dispatch(event)

        result.tenant_id = tenant_id
        return result

    def _extract_signature(
        self,
        headers: dict[str, str | list[str]],
        provider: Provider,
    ) -> bytes | None:
        header_name = SIGNATURE_HEADERS[provider]
        raw = headers.get(header_name)
        if raw is None:
            return None

        if isinstance(raw, list):
            sig_value = raw[0]
        else:
            sig_value = raw

        try:
            return bytes.fromhex(sig_value)
        except (ValueError, TypeError):
            return b""

    def _extract_nonce(
        self,
        headers: dict[str, str | list[str]],
        provider: Provider,
    ) -> str | None:
        header_name = NONCE_HEADERS[provider]
        raw = headers.get(header_name)
        if raw is None:
            return None
        if isinstance(raw, list):
            return raw[0]
        return raw

    def _check_timestamp(
        self,
        headers: dict[str, str | list[str]],
        provider: Provider,
    ) -> bool:
        header_name = TIMESTAMP_HEADERS[provider]
        raw = headers.get(header_name)
        if raw is None:
            return not self.config.require_timestamp

        if isinstance(raw, list):
            raw = raw[0]

        try:
            ts = float(raw)
        except (ValueError, TypeError):
            return False

        now = self._clock()
        return abs(now - ts) <= self.config.timestamp_tolerance

    def _resolve_tenant(
        self,
        headers: dict[str, str | list[str]],
        provider: Provider,
        payload: dict[str, Any],
    ) -> str | None:
        header_name = TENANT_HEADERS[provider]
        raw = headers.get(header_name)
        if isinstance(raw, list):
            raw = raw[0]

        route_tenant_id = raw if raw else None

        if not route_tenant_id:
            route_tenant_id = payload.get("tenant_id")

        return route_tenant_id


# ---------------------------------------------------------------------------
# Key rotation manager
# ---------------------------------------------------------------------------

class KeyRotationManager:
    def __init__(
        self,
        provider_registry: ProviderRegistry,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self._registry = provider_registry
        self._clock = clock or time.time
        self._history: list[dict[str, Any]] = []

    def rotate(
        self,
        provider: Provider,
        new_key: SigningKey,
        grace_period_seconds: float = 86400.0,
    ) -> None:
        config = self._registry.get(provider)
        if config is None:
            raise ValueError(f"Provider {provider.value} not registered")

        old_primary = config.rotation_config.primary_key
        config.rotation_config.legacy_key = old_primary
        config.rotation_config.primary_key = new_key
        config.rotation_config.grace_period_seconds = grace_period_seconds

        self._history.append({
            "provider": provider.value,
            "old_key_id": old_primary.key_id,
            "new_key_id": new_key.key_id,
            "rotated_at": self._clock(),
            "grace_period": grace_period_seconds,
        })

    def rotation_history(self, provider: Provider) -> list[dict[str, Any]]:
        return [h for h in self._history if h["provider"] == provider.value]


# ---------------------------------------------------------------------------
# Batch processor
# ---------------------------------------------------------------------------

class BatchProcessor:
    def __init__(self, gateway: WebhookGateway, batch_limit: int = 50) -> None:
        self._gateway = gateway
        self._batch_limit = batch_limit
        self._processed: list[VerificationResult] = []

    def process(
        self,
        requests: list[tuple[dict[str, str | list[str]], bytes]],
    ) -> list[VerificationResult]:
        results: list[VerificationResult] = []
        for headers, body in requests[: self._batch_limit]:
            result = self._gateway.process_webhook(headers, body)
            self._processed.append(result)
            results.append(result)
        return results

    @property
    def accepted_count(self) -> int:
        return sum(1 for r in self._processed if r.valid)

    def reset(self) -> None:
        self._processed.clear()


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

class GatewayHealth:
    def __init__(self, gateway: WebhookGateway, sla_threshold: float = 0.9995) -> None:
        self._gateway = gateway
        self._threshold = sla_threshold

    @property
    def healthy(self) -> bool:
        return self._gateway.metrics.acceptance_rate >= self._threshold

    def status(self) -> dict[str, Any]:
        m = self._gateway.metrics
        return {
            "healthy": self.healthy,
            "acceptance_rate": m.acceptance_rate,
            "total": m.total_requests,
            "replay_rejections": m.replay_rejections,
        }



# ---------------------------------------------------------------------------
# Request builder (testing helper)
# ---------------------------------------------------------------------------

class RequestBuilder:
    def __init__(self, provider: Provider, signing_key: SigningKey) -> None:
        self._provider = provider
        self._key = signing_key
        self._algorithm = PROVIDER_ALGORITHMS[provider]

    def build(
        self,
        payload: dict[str, Any],
        tenant_id: str,
        nonce: str | None = None,
        timestamp: float | None = None,
    ) -> tuple[dict[str, str], bytes]:
        raw_body = json.dumps(
            payload, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")

        hash_fn = getattr(hashlib, self._algorithm)
        sig = hmac.new(self._key.secret, raw_body, hash_fn).digest()

        headers: dict[str, str] = {}
        headers[SIGNATURE_HEADERS[self._provider]] = sig.hex()

        if tenant_id:
            headers[TENANT_HEADERS[self._provider]] = tenant_id
        if nonce:
            headers[NONCE_HEADERS[self._provider]] = nonce
        if timestamp is not None:
            headers[TIMESTAMP_HEADERS[self._provider]] = str(timestamp)

        return headers, raw_body

    def build_raw(
        self,
        raw_body: bytes,
        tenant_id: str,
        nonce: str | None = None,
        timestamp: float | None = None,
    ) -> tuple[dict[str, str], bytes]:
        hash_fn = getattr(hashlib, self._algorithm)
        sig = hmac.new(self._key.secret, raw_body, hash_fn).digest()
        headers: dict[str, str] = {SIGNATURE_HEADERS[self._provider]: sig.hex()}
        if tenant_id:
            headers[TENANT_HEADERS[self._provider]] = tenant_id
        if nonce:
            headers[NONCE_HEADERS[self._provider]] = nonce
        if timestamp is not None:
            headers[TIMESTAMP_HEADERS[self._provider]] = str(timestamp)
        return headers, raw_body


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def create_gateway(
    providers: list[ProviderConfig],
    tenants: list[str],
    config: GatewayConfig | None = None,
    clock: Callable[[], float] | None = None,
) -> WebhookGateway:
    provider_registry = ProviderRegistry()
    for p in providers:
        provider_registry.register(p)

    tenant_registry = TenantRegistry()
    for t in tenants:
        tenant_registry.register(t)

    effective_config = config or GatewayConfig()
    nonce_store = NonceStore(
        ttl_seconds=effective_config.nonce_ttl_seconds, clock=clock
    )
    dispatcher = EventDispatcher()

    return WebhookGateway(
        provider_registry=provider_registry,
        tenant_registry=tenant_registry,
        nonce_store=nonce_store,
        dispatcher=dispatcher,
        config=effective_config,
        clock=clock,
    )
