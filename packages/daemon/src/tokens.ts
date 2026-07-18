/**
 * `@jini/core` DI tokens for this package's kernel services, per
 * extraction-plan §2.2 ("Kernel exports only kernel-service tokens... every
 * other token lives in its owning feature package") — `RunLifecycle`,
 * `EventLog`, and `ToolExecutor` are themselves kernel nouns (§2.1), so
 * their tokens are defined here, alongside the services, rather than in
 * `@jini/core` itself. A pack composes against them the same way
 * `packages/core/src/index.test.ts` demonstrates for its own example tokens.
 */
import { token } from '@jini/core';
import type { EventLog } from './event-log.js';
import type { RunLifecycle } from './run-lifecycle.js';
import type { ToolExecutor } from './tool-executor.js';

export const RunLifecycleToken = token<RunLifecycle>('jini.runLifecycle');
export const EventLogToken = token<EventLog>('jini.eventLog');
export const ToolExecutorToken = token<ToolExecutor>('jini.toolExecutor');
