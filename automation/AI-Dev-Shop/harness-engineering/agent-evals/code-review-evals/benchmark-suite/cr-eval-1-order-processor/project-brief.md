# Order Processor — Project Brief

## Overview

The checkout saga coordinates payment capture, inventory reservation, promotion
credits, and fulfillment for our marketplace. This change ships the saga from
prototype to production readiness.

## Operational Context

- Payment gateway: responses take up to 60s under load; sends async webhook
  callbacks for payment state changes
- Infrastructure: 3 worker pods, deployed via rolling update 2-3 times per day
- Inventory: reservation hold system with configurable TTL per environment
- Platform: multi-tenant SaaS, ~200 active tenants on shared infrastructure
- Admin tooling: support staff troubleshoot orders across the platform
- Promotions: loyalty credits applied during checkout as part of a marketing
  initiative launching next quarter

## Requirements

1. Complete checkout flow: reserve inventory, capture payment, apply promotions,
   confirm order.
2. Customers can cancel orders before fulfillment ships.
3. The saga processes ~800 orders/minute at peak across 3 worker pods.
4. Gateway webhook callbacks update order state independently of the original
   request.
5. The fulfillment service, analytics pipeline, and compliance audit all consume
   saga events to do their jobs.
6. The support team uses a separate admin tool to troubleshoot customer issues
   across the platform.

## Spec Hash

`spec-order-saga-v3-ae91f2`
