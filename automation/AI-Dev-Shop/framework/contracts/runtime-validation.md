# Runtime Validation Contract

Host projects declare their runtime validation setup here so agents can verify runtime-changing work without guessing.

This contract defines **what** the host project declares. For **how** agents execute the validation loop, see `<AI_DEV_SHOP_ROOT>/harness-engineering/runtime/self-validation.md`.

## Host Declaration Location

`<ADS_MEMORY_ROOT>/governance/contracts/runtime-validation.md`

## Required Fields

### boot_command

The exact command to start the application or service.

- **Command**: e.g., `npm run dev`, `docker compose up -d`
- **Working directory**: project root unless specified
- **Timeout**: maximum seconds to wait for healthy signal (default: 60)

### healthy_signal

How to know the service is ready.

- **Signal type**: one of `stdout_match`, `http_status`, `port_open`, `file_exists`
- **Value**: the match string, URL, port number, or file path
- **Example**: `stdout_match: "Ready on http://localhost:3000"` or `http_status: GET http://localhost:3000/health → 200`

### critical_path_check

One concrete verification that the main functionality works.

- **Description**: what this checks (e.g., "user can create an account")
- **Method**: how to verify — curl command, browser action, CLI command, or script path
- **Expected result**: what success looks like

### negative_path_check

One verification that a failure mode is handled correctly.

- **Description**: what this checks (e.g., "invalid input returns 400, not 500")
- **Method**: how to trigger the failure case
- **Expected result**: what correct failure handling looks like

### artifact_capture_path

Where to save evidence when something fails.

- **Path**: e.g., `<ADS_MEMORY_ROOT>/reports/self-validation/artifacts/`
- **What to capture**: logs, screenshots, network traces, DOM dumps — whatever is relevant to the stack

### teardown_command

How to stop the service after validation.

- **Command**: e.g., `docker compose down`, `kill %1`, `npx kill-port 3000`
- **Required**: yes — every boot must have a corresponding teardown

## Optional Fields

### env_requirements

Environment variables or services required before boot.

- **Variables**: list of required env vars (e.g., `DATABASE_URL`, `REDIS_URL`)
- **Services**: external dependencies that must be running (e.g., "PostgreSQL on port 5432")
- **Setup command**: optional one-time setup (e.g., `npm run db:migrate`)

### stack_checks

Additional stack-specific runtime checks beyond the critical/negative path.

- Each entry: description, method, expected result, blocking (yes/no)

## When This Contract Is Required

The same triggers as self-validation (from `harness-engineering/runtime/self-validation.md`):

- Runtime startup or configuration changes
- HTTP/API behavior changes
- Browser or mobile UI behavior changes
- Auth, background jobs, queues, or integration changes
- Database migrations or deployment-sensitive changes

Pure documentation, policy/docs-only edits, and non-runtime markdown work are exempt.

## Outcome Model

Agents must use one of these statuses after executing the validation loop:

- **PASS**: all required runtime checks succeeded
- **PARTIAL**: bounded attempts used, exact failure recorded, work can continue with explicit risk because the issue is environmental or locally unverifiable
- **BLOCKER**: runtime evidence shows a confirmed critical-path regression, data-loss risk, auth break, or other ship-blocking issue

These definitions are authoritative. `harness-engineering/runtime/self-validation.md` references this contract for outcome semantics.

## Behavior When Contract Is Missing

See [enforcement.md](enforcement.md). Summary:

- **Greenfield**: runtime-changing work cannot achieve better than PARTIAL without a declared contract
- **Brownfield**: advisory mode — agents proceed but must note in handoff that runtime validation was not formally declared
