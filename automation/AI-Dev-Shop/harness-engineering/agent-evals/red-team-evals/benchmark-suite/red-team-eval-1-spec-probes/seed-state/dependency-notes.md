# Dependency Notes

## Identity Provider

The upstream identity provider create-pending-identity call is not idempotent. A retry can create a second pending identity unless the caller supplies an explicit idempotency key.

## Rendering Framework

All rendered invitation fields are pre-escaped before this feature receives them. Display name output from this feature is not rendered raw.
