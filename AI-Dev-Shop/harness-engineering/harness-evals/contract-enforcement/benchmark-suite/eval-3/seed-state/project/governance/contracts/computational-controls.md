# Computational Controls

## lint
- Command: npx eslint src/ --max-warnings 0
- Working directory: project root
- Required: yes
- Blocking: yes
- Timeout: 120
- Success criteria: exit code 0

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
- Command: (gap — not yet configured)
- Required: no
- Blocking: no

## static_analysis
- Command: (gap — not yet configured)
- Required: no
- Blocking: no
