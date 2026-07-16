# Registry Integrity Policy

This file defines the rule behind `validate_registry_integrity.py`.

## Default Rule

Every canonical shared skill at `skills/*/SKILL.md` must be represented in `framework/routing/skills-registry.md`.

Warnings are not enough here. If a skill exists on disk but is invisible in the registry, agents and maintainers can miss it during dispatch, audits, and cleanup work.

## Hard-Fail Conditions

The validator fails when any of these are true:

- `skills-registry.md` references a path that does not exist
- a canonical shared skill exists on disk but is missing from `skills-registry.md`
- the same canonical skill is registered more than once
- an exception entry points at a missing skill

## Exception Path

Intentional exclusions belong in `framework/routing/skills-registry-exceptions.md`.

Use an exception only when:

- the skill is intentionally dormant or migration-only
- the skill should remain on disk temporarily
- registering it would mislead dispatch decisions

Do not use the exception file as a dumping ground for unfinished registry work.

## Why This Exists

- routing quality depends on complete registry coverage
- stale or invisible skills create silent drift
- a hard gate is cheaper than rediscovering missing skills in production use
