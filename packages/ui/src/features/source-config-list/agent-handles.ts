/**
 * @module agent-handles
 *
 * How this feature turns the ONE base handle a host passes as `agentHandle` into the
 * `data-agent-*` markup for every sub-element it publishes.
 *
 * A host names a component (`agentHandle="mcp-add"`); the component names its own parts. That
 * split is deliberate: only the component knows it has a "Show" toggle next to the password box,
 * what verb applies to each control, and what each one is called — a caller supplying an
 * id-per-element map would have to re-derive all of it, and re-derive it again on every internal
 * change. See `@jini-ai/agentic`'s `element-handles.ts` for the markup convention itself.
 *
 * ## The scheme
 *
 * | element | handle |
 * |---|---|
 * | the component itself | `<base>` |
 * | an action on it | `<base>-<action>` — e.g. `mcp-add-submit`, `mcp-server-1-remove` |
 * | one host-described field | `<base>-field-<kebab-cased spec.key>` — e.g. `mcp-add-field-oauth-client-id` |
 * | a control belonging to a field | `<field handle>-<action>` — e.g. `mcp-add-field-api-key-reveal` |
 *
 * Fields sit under their own `-field-` namespace rather than directly under the base so that a
 * host whose source shape happens to contain a field keyed `remove` or `save` cannot collide with
 * this feature's own action handles. A duplicate handle is not a cosmetic problem: it makes
 * `page.fill`/`page.click` ambiguous for the very element a caller was most likely to want.
 */
import { agentHandle, type AgentElementRole, type AgentHandleProps } from '@jini-ai/agentic';

/** Segments of a derived handle: `<base>-field-<key>` and `<base>-<action>` share one joiner. */
const HANDLE_SEPARATOR = '-';

/** The namespace every host-described field sits under — see this module's doc for why. */
const FIELD_NAMESPACE = 'field';

/** What an unnameable field key degrades to, so it still produces a resolvable handle. */
const UNNAMEABLE_FIELD_SEGMENT = 'unnamed';

/**
 * Reduces one segment to the `[a-z0-9]+(-[a-z0-9]+)*` alphabet handles are restricted to.
 *
 * `SourceFieldSpec.key` is host data, not a handle: nothing stops a host keying a field
 * `oauthClientId`, `api_key`, or `Base URL`. `agentHandle()` THROWS on anything outside the
 * pattern, and a throw here would take down the whole settings surface for a field spec that is
 * otherwise perfectly valid — so keys are sanitized rather than validated, the same call this
 * package's `McpUiSurfaceCard` already makes for producer-supplied `ui://` URIs. The base handle
 * is NOT sanitized: it is the host's own explicit choice of name, and a bad one should fail loudly
 * at the first render rather than silently answer to a handle the host never wrote.
 *
 * @param segment - Arbitrary host text.
 * @returns The sanitized segment, or `''` when nothing survives.
 * @complexity O(n) in `segment.length`.
 */
function sanitizeHandleSegment(segment: string): string {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, `$1${HANDLE_SEPARATOR}$2`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, HANDLE_SEPARATOR)
    .replace(/^-+|-+$/g, '');
}

/**
 * The handle for one action or sub-control published under `base`.
 *
 * Exported because a nested component that publishes handles of its own (`SourceConfigField`,
 * `SourceConfigTestControl`) is handed a base rather than props — its parent derives that base
 * with this, and the child then derives its own parts from it the same way.
 *
 * @param base - The component's own handle, as published by the host. Must already be a valid
 *   element handle — see {@link sanitizeHandleSegment} for why this one is not sanitized.
 * @param action - The sub-element's name. Always a literal chosen by this feature, never host data.
 * @returns `<base>-<action>`.
 * @complexity O(1).
 */
export function sourceConfigActionHandle(base: string, action: string): string {
  return `${base}${HANDLE_SEPARATOR}${action}`;
}

/**
 * The handle for one host-described field rendered under `base`.
 *
 * @param base - The component's own handle, as published by the host.
 * @param fieldKey - The `SourceFieldSpec.key` this field renders. Host data, so it is sanitized.
 * @returns `<base>-field-<kebab-cased key>`.
 * @complexity O(n) in `fieldKey.length`.
 */
export function sourceConfigFieldHandle(base: string, fieldKey: string): string {
  const segment = sanitizeHandleSegment(fieldKey);
  return [base, FIELD_NAMESPACE, segment === '' ? UNNAMEABLE_FIELD_SEGMENT : segment].join(
    HANDLE_SEPARATOR,
  );
}

/** What to publish about one sub-element — see {@link sourceConfigAgentProps}. */
export interface SourceConfigAgentPropsOptions {
  /** Which verb applies to this element. */
  readonly role: AgentElementRole;
  /**
   * Stable ontology for this element — what the control IS, never what it currently says. A
   * reveal toggle is labelled by the field it reveals, not by the live "Show"/"Hide" on its face,
   * so a caller can address the same element across the whole session.
   */
  readonly label: string;
  /**
   * The sub-element's name, appended to `base`. Omit when the element IS `base` — the component's
   * own root.
   */
  readonly action?: string;
}

/**
 * Builds the `data-agent-*` attribute props for one sub-element, or nothing at all when the host
 * published no base handle.
 *
 * Returning `{}` rather than throwing is what keeps `agentHandle` an opt-in prop: a host with no
 * agent-control surface renders exactly the markup it did before this existed.
 *
 * @param base - The component's own handle from the host, or `undefined` when it published none.
 * @param options - Role, stable label, and the optional action naming this sub-element.
 * @returns Spreadable attribute props, or `{}` when `base` is `undefined`.
 * @throws If `base` is not a valid element handle — via `agentHandle()`, deliberately unguarded.
 * @complexity O(1).
 */
export function sourceConfigAgentProps(
  base: string | undefined,
  options: SourceConfigAgentPropsOptions,
): AgentHandleProps | Record<string, never> {
  if (base === undefined) return {};
  const handle = options.action === undefined ? base : sourceConfigActionHandle(base, options.action);
  return agentHandle(handle, { role: options.role, label: options.label });
}
