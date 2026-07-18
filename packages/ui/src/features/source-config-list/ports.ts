/**
 * The DI seam. Everything in this feature reaches transport only through
 * this interface — `dependencies.ts` is the one file allowed to bind a real
 * implementation. Host-injected adapters do the actual network calls; none
 * of the four origin sources' specific endpoints (the daemon's
 * `/api/mcp/servers`, OD's BYOK config endpoint, the plugin-marketplace
 * fetch, etc.) become part of this generic primitive.
 *
 * `refreshSource`/`setTrust`/`testSource` are optional on purpose: not every
 * source shape supports every action (the origin MCP-server shape has no
 * trust concept at all; a plugin marketplace has no per-item connection
 * test). The React layer derives which per-item actions to render from
 * which of these methods a host's port actually implements, rather than a
 * separate set of boolean feature flags a host would have to keep in sync.
 */
import type {
  AddSourceInput,
  AddSourceResult,
  SourceConfigItem,
  SourceFieldValues,
  SourceTestResult,
} from './types.js';

export interface SourceConfigPort<TSource extends SourceConfigItem = SourceConfigItem> {
  fetchSources(): Promise<TSource[]>;
  addSource(input: AddSourceInput): Promise<AddSourceResult<TSource>>;
  removeSource(id: string): Promise<boolean>;
  /** Optional: omit for a source shape with nothing to re-fetch (e.g. a static BYOK key entry). */
  refreshSource?(id: string): Promise<TSource | null>;
  /** Optional: omit for a source shape with no trust/authorization-level concept. */
  setTrust?(id: string, trust: string): Promise<TSource | null>;
  /** Optional: omit for a source shape with no connection-test concept. `draft`, when supplied, lets a host test unsaved field edits (the byok "test before save" UX) rather than only the last-persisted values. */
  testSource?(id: string, draft?: SourceFieldValues): Promise<SourceTestResult>;
}

export interface SourceConfigDependencies<TSource extends SourceConfigItem = SourceConfigItem> {
  port: SourceConfigPort<TSource>;
}
