// DOM bridges owned exclusively by agent-tool browser actions (slice 2,
// issue #5398): a wrapper over the router's `navigate()` and a constrained
// element-click helper. Reached through runtime/browser-action-executor.ts,
// shared by every conversation loop that can receive a `browser_action_request`
// (ProjectView's primary chat, and useConversationChat's Side Chat tab /
// GlobalAssistantHost loop).
//
// `clickElement` resolves `target` ONLY against elements carrying a
// `data-agent-target="<value>"` attribute — an explicit, author-controlled
// allowlist — never an arbitrary CSS selector. A free-form
// `document.querySelector(<model-supplied selector>)?.click()` could hit
// "Delete project," submit forms, or trigger paid generation — anything the
// user can click — which would break the `ui.click` tool descriptor's
// `viewStateOnly: true` contract. `target` is untrusted model output, so it
// is passed through `CSS.escape` before being interpolated into the
// attribute-selector string.

import { navigate, type Route } from '../../router';
import type { JsonValue } from '@open-design/contracts';

const BROWSER_SESSION_ID_KEY = 'od.browser-action-session-id';

/**
 * Stable identity for "this browser tab", for the whole tab lifetime — not
 * per-component-mount (a `useRef(randomUUID())` in a component that remounts
 * on navigation, e.g. ProjectView switching projects, would silently change
 * identity mid-session). Backed by sessionStorage so it survives reloads but
 * not new tabs/windows, matching the daemon's `preferredSessionId` claim
 * targeting (pending-invocations.ts) — a run created in this tab prefers
 * browser actions to execute back in this same tab, not whichever tab wins
 * the SSE broadcast race.
 */
export function getBrowserSessionId(): string {
  if (typeof window === 'undefined') return crypto.randomUUID();
  let id = window.sessionStorage.getItem(BROWSER_SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(BROWSER_SESSION_ID_KEY, id);
  }
  return id;
}

const PRIMARY_APP_SESSION_ID_KEY = 'od.primary-app-browser-session-id';

/**
 * AppInner publishes its own getBrowserSessionId() here (localStorage —
 * shared across same-origin tabs/windows, unlike sessionStorage) on every
 * render that is NOT the detached /assistant-window itself. The detached
 * window has its own independent sessionStorage, so getBrowserSessionId()
 * there would mint a session id for a window with no Open Design DOM to act
 * on — reading the published id instead lets a workspace conversation
 * created from the detached window still prefer routing its browser actions
 * (navigation.goto, ui.click, ...) back to the actual main app window.
 */
export function publishPrimaryAppSessionId(id: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PRIMARY_APP_SESSION_ID_KEY, id);
}

/**
 * Falls back to this window's own id if no primary app window has published
 * one yet (e.g. the detached window was opened before the main window ever
 * mounted) — degraded to today's un-targeted behavior rather than throwing.
 */
export function getPrimaryAppSessionId(): string {
  if (typeof window === 'undefined') return getBrowserSessionId();
  return window.localStorage.getItem(PRIMARY_APP_SESSION_ID_KEY) ?? getBrowserSessionId();
}

export function navigateTo(route: Route, opts: { replace?: boolean } = {}): void {
  navigate(route, opts);
}

export function clickElement(target: string): boolean {
  if (typeof document === 'undefined') return false;
  const selector = `[data-agent-target="${CSS.escape(target)}"]`;
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return false;
  element.click();
  return true;
}

// ---------------------------------------------------------------------------
// ui.fill / ui.waitFor / ui.observe — extends the browser-action tool set
// beyond navigation.goto/ui.click, per the swarm-consensus report at
// ADS-memory/reports/swarm-consensus/runs/2026-07-12-global-assistant-chat-scope-consensus-report.md.
//
// `ui.fill` deliberately uses a SEPARATE `data-agent-field` allowlist
// attribute rather than reusing `data-agent-target` — an element being
// clickable and an element being fillable are different author decisions
// (e.g. "rename project" may be agent-writable while "billing email" simply
// never carries the attribute), and a single shared vocabulary would blur
// that. `ui.waitFor`/`ui.observe` address either vocabulary, since both are
// legitimate things to wait for or read state from.
// ---------------------------------------------------------------------------

export type FillFieldResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'not_fillable' };

const FILLABLE_TAGS = new Set(['INPUT', 'TEXTAREA']);
const NEVER_FILLABLE_INPUT_TYPES = new Set(['password', 'file', 'hidden', 'checkbox', 'radio', 'submit', 'button', 'image', 'reset']);

function resolveFillableElement(field: string): HTMLElement | null {
  const selector = `[data-agent-field="${CSS.escape(field)}"]`;
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;
  if (element.isContentEditable) return element;
  if (FILLABLE_TAGS.has(element.tagName)) {
    const type = (element as HTMLInputElement).type?.toLowerCase();
    if (element.tagName === 'INPUT' && type && NEVER_FILLABLE_INPUT_TYPES.has(type)) return null;
    return element;
  }
  return null;
}

/**
 * Writes `value` into the agent-writable field named `field`. Never submits
 * — committing a durable action stays a separately-allowlisted `ui.click` on
 * an explicit submit control, so a fill can't accidentally trigger it.
 * Bypasses React's synthetic value tracking via the native property setter
 * (the same technique React DevTools/testing-library use) so the framework's
 * own onChange fires from the dispatched `input` event, exactly as if the
 * user had typed — a plain `element.value = ...` alone is invisible to a
 * React-controlled input.
 */
export function fillField(field: string, value: string): FillFieldResult {
  if (typeof document === 'undefined') return { ok: false, reason: 'not_found' };
  const element = resolveFillableElement(field);
  if (!element) {
    const exists = document.querySelector(`[data-agent-field="${CSS.escape(field)}"]`);
    return { ok: false, reason: exists ? 'not_fillable' : 'not_found' };
  }
  if (element.isContentEditable) {
    element.textContent = value;
  } else {
    const proto = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(element, value);
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true };
}

export type WaitForState = 'visible' | 'hidden' | 'enabled';

function resolveWaitTarget(target: string): HTMLElement | null {
  const selector = `[data-agent-target="${CSS.escape(target)}"], [data-agent-field="${CSS.escape(target)}"]`;
  return document.querySelector<HTMLElement>(selector);
}

function isElementVisible(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isElementEnabled(element: HTMLElement): boolean {
  if ((element as HTMLInputElement).disabled) return false;
  if (element.getAttribute('aria-disabled') === 'true') return false;
  return true;
}

function checkWaitForState(target: string, state: WaitForState): boolean {
  const element = resolveWaitTarget(target);
  if (state === 'hidden') return !element || !isElementVisible(element);
  if (!element || !isElementVisible(element)) return false;
  return state === 'visible' || isElementEnabled(element);
}

/**
 * Resolves once `target` (a data-agent-target or data-agent-field value)
 * reaches `state`, or `timeoutMs` elapses. Backed by a MutationObserver on
 * the whole document (attribute/childList/subtree) plus a light interval
 * poll fallback for pure-CSS visibility changes a MutationObserver can't see
 * (e.g. a class-driven transition with no attribute the observer would
 * catch on its own — the poll is the safety net, the observer is the fast
 * path). Never rejects; a timeout resolves `false` like a normal outcome.
 */
export function waitForTarget(target: string, state: WaitForState, timeoutMs: number): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  if (checkWaitForState(target, state)) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
      resolve(result);
    };
    const check = () => {
      if (checkWaitForState(target, state)) finish(true);
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    const pollId = window.setInterval(check, 200);
    const timeoutId = window.setTimeout(() => finish(false), timeoutMs);
  });
}

// The index signatures below are what let these flow straight into
// BrowserActionResult's `result: JsonValue` at the ProjectView.tsx call site
// — a plain named interface has no index signature, so TypeScript rejects
// assigning it to JsonValue's `{ [key: string]: JsonValue }` object branch
// even though every field here is already JSON-safe.
export interface ObservedElement {
  [key: string]: JsonValue;
  /** The data-agent-target or data-agent-field value, whichever the element carries. */
  id: string;
  kind: 'target' | 'field';
  /** Coarse role derived from the tag/ARIA role — not a full accessibility tree. */
  role: string;
  /** Accessible label, truncated — never raw innerHTML. */
  label: string;
  visible: boolean;
  disabled: boolean;
  /** Null unless the field is explicitly opted in via data-agent-observe="value". */
  value: string | null;
}

export interface ObserveResult {
  [key: string]: JsonValue;
  route: string;
  elements: ObservedElement[];
  truncated: boolean;
}

const OBSERVE_MAX_ELEMENTS = 100;
const OBSERVE_LABEL_MAX_LENGTH = 120;
const OBSERVE_VALUE_MAX_LENGTH = 500;

function accessibleLabel(element: HTMLElement): string {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.slice(0, OBSERVE_LABEL_MAX_LENGTH);
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl?.textContent) return labelEl.textContent.trim().slice(0, OBSERVE_LABEL_MAX_LENGTH);
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.placeholder) return element.placeholder.slice(0, OBSERVE_LABEL_MAX_LENGTH);
  }
  const text = element.textContent?.trim() ?? '';
  return text.slice(0, OBSERVE_LABEL_MAX_LENGTH);
}

function coarseRole(element: HTMLElement): string {
  const explicit = element.getAttribute('role');
  if (explicit) return explicit;
  if (element instanceof HTMLButtonElement) return 'button';
  if (element instanceof HTMLInputElement) return element.type === 'checkbox' || element.type === 'radio' ? element.type : 'textbox';
  if (element instanceof HTMLTextAreaElement) return 'textbox';
  if (element instanceof HTMLAnchorElement) return 'link';
  if (element.isContentEditable) return 'textbox';
  return 'generic';
}

/**
 * Reads a bounded, structured snapshot of currently agent-addressable UI —
 * never raw DOM/innerHTML. Everything this returns flows straight into live
 * model context (same reasoning as MAX_ERROR_MESSAGE_LENGTH in
 * routes/browser-actions.ts's result parsing), so an unbounded scrape would
 * be a prompt-injection channel from page content an author never
 * explicitly opted into exposing. `value` is included only for a field
 * explicitly marked `data-agent-observe="value"` — reading form values by
 * default would leak whatever the user typed, including anything sensitive
 * a field's data-agent-field opt-in never promised to expose for reading.
 */
export function observeTargets(filter?: string): ObserveResult {
  if (typeof document === 'undefined') return { route: '', elements: [], truncated: false };
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-agent-target], [data-agent-field]'));
  const filtered = filter
    ? nodes.filter((el) => {
        const id = el.getAttribute('data-agent-target') ?? el.getAttribute('data-agent-field') ?? '';
        return id.startsWith(filter);
      })
    : nodes;
  const truncated = filtered.length > OBSERVE_MAX_ELEMENTS;
  const elements: ObservedElement[] = filtered.slice(0, OBSERVE_MAX_ELEMENTS).map((el) => {
    const targetId = el.getAttribute('data-agent-target');
    const fieldId = el.getAttribute('data-agent-field');
    const canObserveValue = fieldId && el.getAttribute('data-agent-observe') === 'value';
    const rawValue = canObserveValue
      ? (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : el.textContent ?? '')
      : null;
    return {
      id: (targetId ?? fieldId) as string,
      kind: targetId ? 'target' : 'field',
      role: coarseRole(el),
      label: accessibleLabel(el),
      visible: isElementVisible(el),
      disabled: !isElementEnabled(el),
      value: rawValue !== null ? rawValue.slice(0, OBSERVE_VALUE_MAX_LENGTH) : null,
    };
  });
  return { route: window.location.pathname, elements, truncated };
}
