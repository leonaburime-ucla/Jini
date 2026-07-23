// Executes an incoming `browser_action_request` SSE event against this tab's
// DOM (navigation.goto, ui.click, ui.fill, ui.waitFor, ui.observe), then
// reports the result back to the daemon. Shared by every conversation loop
// that can receive browser-action requests — ProjectView's primary chat and
// useConversationChat's secondary loop (Side Chat tab + GlobalAssistantHost)
// — so a workspace-scoped or side-chat run gets the exact same execution
// behavior as the main project chat instead of silently timing out because
// only one call site ever wired up the handler.
import { parseRoute } from '../router';
import {
  clickElement,
  fillField,
  navigateTo,
  observeTargets,
  waitForTarget,
  type WaitForState,
} from '../providers/dom';
import { AGENT_ACTIONS_PROTOCOL_VERSION } from '@open-design/contracts';
import type { BrowserActionRequestSsePayload, BrowserActionResult } from '@open-design/contracts';

/**
 * Claims, executes, and reports the result of one `browser_action_request`.
 * `handledInvocationIds` guards against a replayed SSE event (reload, second
 * tab, remount) re-firing an already-executed action — callers own the set's
 * lifetime (typically a `useRef<Set<string>>`, cleared per new conversation).
 */
export function executeBrowserActionRequest(
  req: BrowserActionRequestSsePayload,
  browserSessionId: string,
  handledInvocationIds: Set<string>,
): void {
  if (Date.now() > req.expiresAt) return;
  if (handledInvocationIds.has(req.invocationId)) return;
  handledInvocationIds.add(req.invocationId);

  void (async () => {
    // Claim before executing: every tab subscribed to this run's SSE stream
    // receives this same broadcast. If another tab already claimed it, do
    // not execute the DOM side effect here too. A claim-request failure
    // (offline, daemon restart) fails OPEN to executing, same as before,
    // rather than silently dropping the action.
    try {
      const claimResponse = await fetch(
        `/api/runs/${req.runId}/browser-actions/${req.invocationId}/claim`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: browserSessionId }),
        },
      );
      if (claimResponse.ok) {
        const claimBody = (await claimResponse.json()) as { claimed?: boolean };
        if (claimBody.claimed === false) return;
      }
    } catch {
      // Best-effort: proceed to execute rather than strand the action.
    }

    let result: BrowserActionResult;
    try {
      if (req.tool === 'navigation.goto') {
        const input = req.input as { route?: unknown } | null;
        if (typeof input?.route !== 'string') {
          throw new Error('navigation.goto requires a string "route" input');
        }
        navigateTo(parseRoute(input.route));
        result = {
          protocolVersion: AGENT_ACTIONS_PROTOCOL_VERSION,
          invocationId: req.invocationId,
          tool: req.tool,
          ok: true,
          result: { navigated: true },
        };
      } else if (req.tool === 'ui.click') {
        const input = req.input as { target?: unknown } | null;
        if (typeof input?.target !== 'string') {
          throw new Error('ui.click requires a string "target" input');
        }
        const clicked = clickElement(input.target);
        result = clicked
          ? {
              protocolVersion: AGENT_ACTIONS_PROTOCOL_VERSION,
              invocationId: req.invocationId,
              tool: req.tool,
              ok: true,
              result: { clicked: true },
            }
          : {
              protocolVersion: AGENT_ACTIONS_PROTOCOL_VERSION,
              invocationId: req.invocationId,
              tool: req.tool,
              ok: false,
              error: {
                code: 'EXECUTION_FAILED',
                message: `no element found for target "${input.target}"`,
              },
            };
      } else if (req.tool === 'ui.fill') {
        const input = req.input as { field?: unknown; value?: unknown } | null;
        if (typeof input?.field !== 'string' || typeof input?.value !== 'string') {
          throw new Error('ui.fill requires string "field" and "value" inputs');
        }
        const filled = fillField(input.field, input.value);
        result = filled.ok
          ? {
              protocolVersion: AGENT_ACTIONS_PROTOCOL_VERSION,
              invocationId: req.invocationId,
              tool: req.tool,
              ok: true,
              result: { filled: true },
            }
          : {
              protocolVersion: AGENT_ACTIONS_PROTOCOL_VERSION,
              invocationId: req.invocationId,
              tool: req.tool,
              ok: false,
              error: {
                code: 'EXECUTION_FAILED',
                message:
                  filled.reason === 'not_found'
                    ? `no element found for field "${input.field}"`
                    : `field "${input.field}" is not a fillable input/textarea/contenteditable`,
              },
            };
      } else if (req.tool === 'ui.waitFor') {
        const input = req.input as { target?: unknown; state?: unknown; timeoutMs?: unknown } | null;
        if (typeof input?.target !== 'string') {
          throw new Error('ui.waitFor requires a string "target" input');
        }
        const state = input.state;
        if (state !== 'visible' && state !== 'hidden' && state !== 'enabled') {
          throw new Error('ui.waitFor requires "state" to be one of visible, hidden, enabled');
        }
        const timeoutMs =
          typeof input.timeoutMs === 'number'
            ? Math.min(Math.max(input.timeoutMs, 100), 10_000)
            : 5_000;
        const reached = await waitForTarget(input.target, state as WaitForState, timeoutMs);
        result = reached
          ? {
              protocolVersion: AGENT_ACTIONS_PROTOCOL_VERSION,
              invocationId: req.invocationId,
              tool: req.tool,
              ok: true,
              result: { reached: true },
            }
          : {
              protocolVersion: AGENT_ACTIONS_PROTOCOL_VERSION,
              invocationId: req.invocationId,
              tool: req.tool,
              ok: false,
              error: {
                code: 'EXECUTION_FAILED',
                message: `target "${input.target}" did not reach state "${state}" within ${timeoutMs}ms`,
              },
            };
      } else if (req.tool === 'ui.observe') {
        const input = req.input as { filter?: unknown } | null;
        const filter = typeof input?.filter === 'string' ? input.filter : undefined;
        const observed = observeTargets(filter);
        result = {
          protocolVersion: AGENT_ACTIONS_PROTOCOL_VERSION,
          invocationId: req.invocationId,
          tool: req.tool,
          ok: true,
          result: observed,
        };
      } else {
        result = {
          protocolVersion: AGENT_ACTIONS_PROTOCOL_VERSION,
          invocationId: req.invocationId,
          tool: req.tool,
          ok: false,
          error: { code: 'EXECUTION_FAILED', message: `unknown browser tool "${req.tool}"` },
        };
      }
    } catch (err) {
      result = {
        protocolVersion: AGENT_ACTIONS_PROTOCOL_VERSION,
        invocationId: req.invocationId,
        tool: req.tool,
        ok: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }

    try {
      const response = await fetch(
        `/api/runs/${req.runId}/browser-actions/${req.invocationId}/result`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result),
        },
      );
      // A 404 means another client/tab already owned this invocation (or the
      // daemon's own timeout already untracked it) — the handled-id set
      // above is this tab's guard, not the source of truth, so this is not
      // an error to surface to the user.
      void response;
    } catch {
      // Best-effort: the daemon-side dispatch timeout is the visible
      // fallback the model sees if this POST never lands.
    }
  })();
}
