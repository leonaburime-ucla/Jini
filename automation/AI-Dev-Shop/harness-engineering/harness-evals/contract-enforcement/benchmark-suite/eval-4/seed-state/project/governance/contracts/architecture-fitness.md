# Architecture Fitness Rules

## no-legacy-imports-from-internal-api
- Name: no-legacy-imports-from-internal-api
- Type: dependency_direction
- Scope: src/legacy/**
- Source: src/legacy/**
- Forbidden target: src/api/internal/**
- Allowed alternative: use the public API client at src/api/client.ts
- Description: Legacy modules should not reach into internal API implementation
- Severity: advisory
- Rationale: Preparing for eventual legacy module migration; not blocking yet
