/**
 * @module note-store
 *
 * A dependency-light, filesystem-backed markdown fact store: one markdown
 * file per entry (frontmatter `name`/`description`/`type` + a body), a
 * human-editable `INDEX.md` of bullet links that is the source of truth for
 * which entries are "active" (removing a bullet disables an entry without
 * deleting its file), a minimal on/off `.config.json`, and a change-event
 * stream so a host's UI/SSE layer can react to every write.
 *
 * Layout (under `<dataDir>/<config.subdir ?? 'notes'>/`):
 * ```
 * INDEX.md            — one bullet per active entry
 * <type>_<slug>.md    — per-entry body + frontmatter
 * .config.json        — { "enabled": true }
 * ```
 *
 * The entry-type taxonomy (`config.validTypes`/`config.defaultType`) is
 * entirely host-supplied — this module has no opinion on what a "type"
 * means beyond validating against the host's declared set.
 */
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { parseEntryFrontmatter, renderEntryFrontmatter } from './entry-frontmatter.js';

export interface NoteStoreConfig {
  /** The entry-type buckets a host's notes may declare (host-owned taxonomy). */
  validTypes: readonly string[];
  /** Type substituted when a stored/patched type is missing or not in `validTypes`. */
  defaultType: string;
  /** Subdirectory under `dataDir` holding entries/index/config. Defaults to `'notes'`. */
  subdir?: string;
}

export type NoteChangeKind = 'upsert' | 'delete' | 'index' | 'config';

export interface NoteChangeEvent {
  kind: NoteChangeKind;
  id?: string;
  name?: string;
  description?: string;
  type?: string;
  source?: string;
  enabled?: boolean;
  at: number;
}

export interface NoteEntrySummary {
  id: string;
  name: string;
  description: string;
  type: string;
  updatedAt: number;
}

export interface NoteEntry extends NoteEntrySummary {
  body: string;
}

export interface NoteTreeNode {
  id: string;
  parentId: string | null;
  path: string;
  name: string;
  description: string;
  kind: 'folder' | 'entry';
  type: string;
  createdAt: string;
  updatedAt: string;
  childrenCount: number;
}

export interface NoteStoreOptions {
  enabled: boolean;
}

/** A configured note store bound to one type taxonomy; each `dataDir` passed to its methods is an independent store instance on disk. */
export interface NoteStore {
  readonly events: EventEmitter;
  dir(dataDir: string): string;
  deriveId(type: string, name: string): string;
  readConfig(dataDir: string): Promise<NoteStoreOptions>;
  writeConfig(dataDir: string, patch: Partial<NoteStoreOptions>): Promise<NoteStoreOptions>;
  readIndex(dataDir: string): Promise<string>;
  writeIndex(dataDir: string, body: string, options?: { silent?: boolean }): Promise<void>;
  listEntries(dataDir: string): Promise<NoteEntrySummary[]>;
  /**
   * The subset of `listEntries` whose id is linked in `INDEX.md` — the
   * user's hand-edited index is the source of truth for which entries are
   * "active"; removing a bullet disables that entry from a host's prompt/
   * context composition while leaving the file on disk.
   */
  listActiveEntries(dataDir: string): Promise<NoteEntrySummary[]>;
  readEntry(dataDir: string, id: string): Promise<NoteEntry | null>;
  upsertEntry(
    dataDir: string,
    input: { id?: string; name: string; description?: string; type: string; body?: string },
    options?: { silent?: boolean; source?: string },
  ): Promise<NoteEntry>;
  deleteEntry(dataDir: string, id: string): Promise<void>;
  updateTreeNode(
    dataDir: string,
    id: string,
    patch: { name?: string; description?: string; type?: string; body?: string },
  ): Promise<NoteEntry>;
  buildTree(dataDir: string): Promise<NoteTreeNode[]>;
}

const INDEX_FILE = 'INDEX.md';
const CONFIG_FILE = '.config.json';
const DEFAULT_INDEX = '# Notes\n\nOne bullet per active entry. Removing a bullet disables that entry from\nfuture reads; the underlying file stays on disk.\n\n';
const INDEX_LINK_RE = /^\s*-\s+\[([^\]]+)\]\(([^)]+)\)(\s+—\s+(.*))?$/;

function isValidId(id: string): boolean {
  return /^[a-z0-9_]+$/.test(id) && id.length <= 96;
}

async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

/**
 * Construct a note store bound to a host-supplied type taxonomy. Each
 * returned store carries its own `EventEmitter` — instantiate one store per
 * logical note collection rather than sharing a single process-wide emitter,
 * so unrelated stores in the same process never cross-fire events.
 *
 * @param config - The host's type taxonomy and storage subdirectory.
 * @returns A bound `NoteStore`.
 */
export function createNoteStore(config: NoteStoreConfig): NoteStore {
  const validTypes = new Set(config.validTypes);
  const subdir = config.subdir ?? 'notes';
  const events = new EventEmitter();
  events.setMaxListeners(64);

  function emitChange(event: Omit<NoteChangeEvent, 'at'>): void {
    events.emit('change', { ...event, at: Date.now() });
  }

  function isValidType(t: unknown): t is string {
    return typeof t === 'string' && validTypes.has(t);
  }

  function dir(dataDir: string): string {
    return path.join(dataDir, subdir);
  }

  function deriveId(type: string, name: string): string {
    const safeType = isValidType(type) ? type : config.defaultType;
    const raw = String(name || '');
    const cleaned = raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48);
    if (cleaned.length > 0) return `${safeType}_${cleaned}`;
    // FNV-1a 32-bit on the original name — deterministic, dependency-free,
    // and avoids colliding two purely-non-ASCII names on the same fallback slug.
    let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < raw.length; i++) {
      h = (h ^ raw.charCodeAt(i)) >>> 0;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return `${safeType}_n${h.toString(36)}`;
  }

  function entryPath(dataDir: string, id: string): string {
    if (!isValidId(id)) throw new Error('invalid note id');
    return path.join(dir(dataDir), `${id}.md`);
  }

  function indexPath(dataDir: string): string {
    return path.join(dir(dataDir), INDEX_FILE);
  }

  function configPath(dataDir: string): string {
    return path.join(dir(dataDir), CONFIG_FILE);
  }

  async function readConfig(dataDir: string): Promise<NoteStoreOptions> {
    try {
      const raw = await fsp.readFile(configPath(dataDir), 'utf8');
      const parsed = JSON.parse(raw) as { enabled?: unknown };
      return { enabled: parsed?.enabled !== false };
    } catch {
      return { enabled: true };
    }
  }

  async function writeConfig(dataDir: string, patch: Partial<NoteStoreOptions>): Promise<NoteStoreOptions> {
    const current = await readConfig(dataDir);
    const next: NoteStoreOptions = {
      enabled: typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
    };
    await ensureDir(dir(dataDir));
    await fsp.writeFile(configPath(dataDir), JSON.stringify(next, null, 2));
    if (current.enabled !== next.enabled) emitChange({ kind: 'config', enabled: next.enabled });
    return next;
  }

  async function readIndex(dataDir: string): Promise<string> {
    try {
      return await fsp.readFile(indexPath(dataDir), 'utf8');
    } catch {
      return DEFAULT_INDEX;
    }
  }

  async function writeIndex(dataDir: string, body: string, options?: { silent?: boolean }): Promise<void> {
    await ensureDir(dir(dataDir));
    await fsp.writeFile(indexPath(dataDir), body);
    if (!options?.silent) emitChange({ kind: 'index' });
  }

  function summarize(id: string, raw: string, mtime: number): { summary: NoteEntrySummary; body: string } {
    const { data, body } = parseEntryFrontmatter(raw);
    const type = isValidType(data.type) ? data.type : config.defaultType;
    return {
      summary: { id, name: data.name || id, description: data.description, type, updatedAt: mtime },
      body: body.trimStart(),
    };
  }

  async function listEntries(dataDir: string): Promise<NoteEntrySummary[]> {
    let names: string[] = [];
    try {
      names = await fsp.readdir(dir(dataDir));
    } catch {
      return [];
    }
    const out: NoteEntrySummary[] = [];
    for (const name of names) {
      if (!name.endsWith('.md') || name === INDEX_FILE) continue;
      const id = name.slice(0, -3);
      if (!isValidId(id)) continue;
      try {
        const filePath = path.join(dir(dataDir), name);
        const [raw, stat] = await Promise.all([fsp.readFile(filePath, 'utf8'), fsp.stat(filePath)]);
        out.push(summarize(id, raw, stat.mtimeMs).summary);
      } catch {
        // Skip unreadable/malformed files rather than let one shadow the rest.
        continue;
      }
    }
    out.sort((a, b) => b.updatedAt - a.updatedAt);
    return out;
  }

  async function listActiveEntries(dataDir: string): Promise<NoteEntrySummary[]> {
    const [entries, indexBody] = await Promise.all([listEntries(dataDir), readIndex(dataDir)]);
    const linkedIds = parseIndexLinkIds(indexBody);
    return entries.filter((entry) => linkedIds.has(entry.id));
  }

  async function readEntry(dataDir: string, id: string): Promise<NoteEntry | null> {
    let raw: string;
    let stat: { mtimeMs: number };
    try {
      const filePath = entryPath(dataDir, id);
      [raw, stat] = await Promise.all([fsp.readFile(filePath, 'utf8'), fsp.stat(filePath)]);
    } catch {
      return null;
    }
    const { summary, body } = summarize(id, raw, stat.mtimeMs);
    return { ...summary, body };
  }

  function parseIndexLinkIds(indexBody: string): Set<string> {
    const ids = new Set<string>();
    for (const line of indexBody.split(/\r?\n/)) {
      const m = INDEX_LINK_RE.exec(line);
      if (!m) continue;
      // Group 2 is `([^)]+)` (one-or-more, mandatory) — always populated on
      // a successful match; the assertion is TS-required, not reachable-undefined.
      const target = m[2]!;
      if (!target.endsWith('.md') || target === INDEX_FILE) continue;
      const id = target.slice(0, -3);
      if (isValidId(id)) ids.add(id);
    }
    return ids;
  }

  async function ensureIndexHasEntry(dataDir: string, id: string, name: string, description: string): Promise<void> {
    const current = await readIndex(dataDir);
    const lines = current.split(/\r?\n/);
    const link = `${id}.md`;
    const desc = description.replace(/\r?\n/g, ' ').trim();
    const newLine = desc ? `- [${name}](${link}) — ${desc}` : `- [${name}](${link})`;
    let replaced = false;
    for (let i = 0; i < lines.length; i++) {
      // `i < lines.length` bounds the loop, so the index access is always
      // defined — the assertion is TS-required (noUncheckedIndexedAccess).
      const m = INDEX_LINK_RE.exec(lines[i]!);
      if (m && m[2] === link) {
        lines[i] = newLine;
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
      lines.push(newLine);
    }
    // Silent: the caller emits its own change event for the write as a whole.
    await writeIndex(dataDir, lines.join('\n'), { silent: true });
  }

  async function removeIndexLine(dataDir: string, id: string): Promise<void> {
    const current = await readIndex(dataDir);
    const link = `${id}.md`;
    const lines = current.split(/\r?\n/).filter((line) => {
      const m = INDEX_LINK_RE.exec(line);
      return !m || m[2] !== link;
    });
    await writeIndex(dataDir, lines.join('\n'), { silent: true });
  }

  async function upsertEntry(
    dataDir: string,
    input: { id?: string; name: string; description?: string; type: string; body?: string },
    options?: { silent?: boolean; source?: string },
  ): Promise<NoteEntry> {
    const { name, type, body } = input;
    const description = input.description ?? '';
    if (!name || !isValidType(type)) {
      throw new Error('note entry requires `name` and a valid `type`');
    }
    const id = input.id && isValidId(input.id) ? input.id : deriveId(type, name);
    await ensureDir(dir(dataDir));
    await fsp.writeFile(entryPath(dataDir, id), renderEntryFrontmatter({ name, description, type }, body ?? ''));
    await ensureIndexHasEntry(dataDir, id, name, description);
    const entry = await readEntry(dataDir, id);
    if (!entry) throw new Error('failed to read note entry after write');
    if (!options?.silent) {
      emitChange({
        kind: 'upsert',
        id: entry.id,
        name: entry.name,
        description: entry.description,
        type: entry.type,
        ...(options?.source !== undefined ? { source: options.source } : {}),
      });
    }
    return entry;
  }

  async function deleteEntry(dataDir: string, id: string): Promise<void> {
    try {
      await fsp.unlink(entryPath(dataDir, id));
    } catch {
      // Already gone — fine, caller doesn't care.
    }
    await removeIndexLine(dataDir, id);
    emitChange({ kind: 'delete', id });
  }

  async function updateTreeNode(
    dataDir: string,
    id: string,
    patch: { name?: string; description?: string; type?: string; body?: string },
  ): Promise<NoteEntry> {
    if (id.startsWith('folder:')) throw new Error('note tree folders are derived and cannot be edited');
    const current = await readEntry(dataDir, id);
    if (!current) throw new Error('note not found');
    const nextType = isValidType(patch.type) ? patch.type : current.type;
    return upsertEntry(dataDir, {
      id,
      name: patch.name?.trim() ? patch.name : current.name,
      description: patch.description ?? current.description,
      type: nextType,
      body: patch.body ?? current.body,
    });
  }

  function folderId(type: string): string {
    return `folder:${type}`;
  }

  function toIsoTime(ms: number): string {
    return new Date(ms).toISOString();
  }

  async function buildTree(dataDir: string): Promise<NoteTreeNode[]> {
    const entries = await listEntries(dataDir);
    const byType = new Map<string, NoteEntrySummary[]>();
    for (const type of config.validTypes) byType.set(type, []);
    for (const entry of entries) {
      const list = byType.get(entry.type) ?? [];
      list.push(entry);
      byType.set(entry.type, list);
    }

    const nodes: NoteTreeNode[] = [];
    for (const type of config.validTypes) {
      // `byType` was seeded with every `config.validTypes` member just
      // above, so a key drawn from that same list is always present here
      // (an entry whose type falls outside `validTypes` — see line above —
      // adds an extra key, but this loop never visits that extra key).
      const children = byType.get(type)!;
      const folderUpdatedAt = children.reduce((latest, entry) => Math.max(latest, entry.updatedAt), 0);
      const id = folderId(type);
      nodes.push({
        id,
        parentId: null,
        path: `/${type}`,
        name: capitalize(type),
        description: `${capitalize(type)} notes`,
        kind: 'folder',
        type,
        createdAt: toIsoTime(folderUpdatedAt),
        updatedAt: toIsoTime(folderUpdatedAt),
        childrenCount: children.length,
      });
      for (const entry of children) {
        nodes.push({
          id: entry.id,
          parentId: id,
          path: `/${type}/${entry.id}`,
          name: entry.name,
          description: entry.description,
          kind: 'entry',
          type: entry.type,
          createdAt: toIsoTime(entry.updatedAt),
          updatedAt: toIsoTime(entry.updatedAt),
          childrenCount: 0,
        });
      }
    }
    return nodes;
  }

  return {
    events,
    dir,
    deriveId,
    readConfig,
    writeConfig,
    readIndex,
    writeIndex,
    listEntries,
    listActiveEntries,
    readEntry,
    upsertEntry,
    deleteEntry,
    updateTreeNode,
    buildTree,
  };
}
