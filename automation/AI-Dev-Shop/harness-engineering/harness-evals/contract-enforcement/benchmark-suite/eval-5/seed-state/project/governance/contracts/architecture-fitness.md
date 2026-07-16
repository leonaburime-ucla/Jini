# Architecture Fitness Rules

## no-internal-from-external-api
- Name: no-internal-from-external-api
- Type: forbidden_import
- Scope: src/external-api/**
- Forbidden pattern: src/internal/**
- Applies to: src/external-api/**
- Description: External API handlers must not import internal-only modules
- Severity: blocking
- Rationale: Internal modules expose sensitive data structures not safe for external consumption
