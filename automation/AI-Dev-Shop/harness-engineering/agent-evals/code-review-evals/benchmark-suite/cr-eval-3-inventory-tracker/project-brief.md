# Inventory Tracker — Project Brief

## Overview

Review changes to inventory reservations and inter-warehouse transfers. Two
warehouse workers process orders for the same SKU concurrently. A weekly
reconciliation job ensures counts stay consistent. Admin stock adjustments come
from cycle counts, damage reports, and manual overrides.

## Operational Context

- Warehouses: 12 fulfillment centers, each running 2-4 order-picking workers
- Read model: eventually-consistent availability projection refreshed every
  few seconds; used by checkout and storefront display
- Transfers: logistics team moves stock between warehouses 5-10 times per day;
  operations expects zero-loss accounting across moves
- Adjustments: warehouse admins submit cycle-count corrections, damage reports,
  and manual overrides through the back-office tool; the same physical count
  may produce adjustments for multiple warehouses and different reason codes
- Reconciliation: weekly batch job runs during the Sunday-night low-traffic
  window; ops reviews its output Monday morning for stock discrepancies
- Tenancy: multi-tenant SaaS, ~40 active tenants on shared infrastructure;
  each tenant has its own warehouse network

## Requirements

1. Warehouse workers reserve stock during checkout and release it on
   cancellation or fulfillment.
2. Logistics staff transfer stock between warehouses to rebalance inventory
   ahead of demand spikes.
3. Warehouse admins apply adjustments from cycle counts and damage reports.
   Adjustments may arrive more than once due to retries from the back-office
   client.
4. The weekly reconciliation job reports stock health so operations can
   investigate discrepancies before the next sales week.
5. Clock injection supports deterministic testing of reservation expiry
   without real sleeps.

## Spec Hash

`spec-inventory-reservations-v3-a7c12`
