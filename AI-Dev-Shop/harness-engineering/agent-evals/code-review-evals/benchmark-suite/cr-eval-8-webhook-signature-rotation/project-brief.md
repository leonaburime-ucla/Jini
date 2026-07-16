# Webhook Signature Rotation — Project Brief

## Overview

Review webhook handling changes that add provider compatibility and
zero-downtime secret rotation. The gateway processes inbound webhooks from
Stripe, GitHub, and custom providers across our multi-tenant platform. Keys
rotate quarterly per compliance requirements.

## Operational Context

- Multi-tenant webhook gateway: ~40 provider integrations, 300+ tenants
- Providers: Stripe (HMAC-SHA256), GitHub (HMAC-SHA1), custom partners
  (HMAC-SHA512)
- Key rotation: quarterly schedule, compliance mandates zero-downtime during
  transition windows
- Infrastructure: 5 gateway pods behind an L7 load balancer, shared Redis
  cluster for deduplication
- Replay protection: nonces + timestamp validation; we've had replay attack
  attempts in the past from compromised provider endpoints
- Tenant routing: provider-signed payloads include routing metadata to
  dispatch events to the correct tenant processing queue
- SLA: 99.95% webhook acceptance rate — false rejections trigger provider
  retry storms that degrade the entire fleet

## Requirements

1. Verify webhook signatures from multiple providers with distinct signing
   algorithms (SHA-1, SHA-256, SHA-512).
2. Support two active signing keys per provider during rotation windows to
   enable zero-downtime secret transitions.
3. Reject replayed webhooks using nonce + timestamp validation.
4. Route verified webhooks to the correct tenant processing queue.
5. Maintain constant-time signature comparison to prevent timing attacks.
6. Handle provider-specific header formats and payload conventions.
7. Emit verification metrics for the security operations dashboard.

## Spec Hash

`spec-webhook-rotation-v2-c4f87a`
