# Computational Controls
# Last updated: 2026-01-15 (over 120 days ago)

## lint
- Command: npm run lint
- Working directory: project root
- Required: yes
- Blocking: yes
- Timeout: 120
- Success criteria: exit code 0
- Note: Uses ESLint (STALE — project migrated to Biome)

## typecheck
- Command: npx tsc --noEmit
- Required: yes
- Blocking: yes
- Timeout: 180

## build
- Command: npm run build
- Required: yes
- Blocking: yes
- Timeout: 300

## unit_tests
- Command: npm test
- Required: yes
- Blocking: yes
- Timeout: 300

## integration_tests
- Command: (gap)
- Required: no
- Blocking: no

## static_analysis
- Command: (gap)
- Required: no
- Blocking: no
