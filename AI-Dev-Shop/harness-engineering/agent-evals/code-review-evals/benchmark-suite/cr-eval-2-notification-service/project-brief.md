# Notification Service — Project Brief

## Overview

The notification delivery pipeline routes messages across email, SMS, and push
channels for our multi-tenant platform. This change adds multi-provider fallback
with tenant-specific preference resolution, replacing the previous
single-provider-per-channel approach.

## Operational Context

- Platform: multi-tenant SaaS, ~200 tenants on shared infrastructure
- Channels: email, SMS, push — each with a primary and fallback provider
- Providers: occasionally timeout without confirming delivery status; responses
  take up to 30s under load
- Templates: cached for performance; rendered per-tenant with locale variants
- Preferences: users configure quiet hours and channel preferences per topic
- Delivery volume: ~50k notifications/hour across all tenants at peak
- Compliance: GDPR and CCPA require suppression of messages to users who have
  opted out of specific channels for specific topics

## Requirements

1. Route notifications through the configured primary provider, falling back to
   an alternate provider or channel when the primary is unavailable.
2. Suppress duplicate delivery when the same logical notification is processed
   more than once (at-most-once semantics per channel per tenant).
3. Respect user channel preferences and topic suppression rules before sending.
4. Render notification content from cached templates with locale support.
5. Enforce user-configured quiet hours so notifications are deferred rather
   than delivered at antisocial times.
6. Log delivery outcomes for operational debugging and compliance audit.

## Spec Hash

`spec-notification-delivery-v4-b83e1`
