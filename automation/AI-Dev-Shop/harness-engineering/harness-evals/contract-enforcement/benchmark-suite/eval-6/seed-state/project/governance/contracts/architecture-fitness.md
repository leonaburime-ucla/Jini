# Architecture Fitness Rules

## ui-no-direct-data-imports
- Name: ui-no-direct-data-imports
- Type: dependency_direction
- Scope: src/ui/**
- Source: src/ui/**
- Forbidden target: src/data/**
- Allowed alternative: use service layer at src/services/
- Description: UI components should access data through the service layer, not directly
- Severity: advisory
- Rationale: Keeps UI testable without database setup; long-term migration target
