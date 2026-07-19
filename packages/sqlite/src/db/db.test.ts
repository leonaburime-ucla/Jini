import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  openDatabase,
  closeDatabase,
  migrate,
  listConversations,
  getConversation,
  normalizeConversationSessionMode,
  insertConversation,
  updateConversation,
  deleteConversation,
  parseJsonOrUndef,
  row,
  rows,
  type SqliteDb,
} from './index.js';

const tmpDirs: string[] = [];
function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jini-db-'));
  tmpDirs.push(d);
  return d;
}
function seedProject(db: SqliteDb, id = 'p1'): string {
  db.prepare(`INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(id, 'P', 1, 1);
  return id;
}
interface SeedMsg {
  id: string;
  cid: string;
  role?: string;
  position?: number;
  runStatus?: string | null;
  startedAt?: number | null;
  endedAt?: number | null;
  eventsJson?: string | null;
}
function seedMessage(db: SqliteDb, m: SeedMsg): void {
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, position, created_at, run_status, started_at, ended_at, events_json)
     VALUES (@id, @cid, @role, '', @position, 0, @runStatus, @startedAt, @endedAt, @eventsJson)`,
  ).run({
    id: m.id,
    cid: m.cid,
    role: m.role ?? 'assistant',
    position: m.position ?? 0,
    runStatus: m.runStatus ?? null,
    startedAt: m.startedAt ?? null,
    endedAt: m.endedAt ?? null,
    eventsJson: m.eventsJson ?? null,
  });
}

afterEach(() => {
  closeDatabase();
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('connection + schema', () => {
  it('opens under a .jini subfolder by default, creating the generic tables', () => {
    const dir = tmp();
    const db = openDatabase(dir);
    const tables = (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[])
      .map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['projects', 'conversations', 'messages', 'agent_sessions']));
    // product tables are NOT ported
    expect(tables).not.toContain('deployments');
    expect(tables).not.toContain('preview_comments');
    expect(fs.existsSync(path.join(dir, '.jini', 'app.sqlite'))).toBe(true);
  });

  it('honors an explicit dataDir over the default', () => {
    const dir = tmp();
    openDatabase('/unused-root', { dataDir: dir });
    expect(fs.existsSync(path.join(dir, 'app.sqlite'))).toBe(true);
  });

  it('returns the cached handle for the same resolved path', () => {
    const dir = tmp();
    const a = openDatabase('/r', { dataDir: dir });
    const b = openDatabase('/r', { dataDir: dir });
    expect(b).toBe(a);
  });

  it('closes the previous connection when opening a different path', () => {
    const a = openDatabase('/r', { dataDir: tmp() });
    const b = openDatabase('/r', { dataDir: tmp() });
    expect(b).not.toBe(a);
    expect(() => a.prepare('SELECT 1')).toThrow(); // previous handle is closed
  });

  it('closeDatabase is a safe no-op when nothing is open', () => {
    closeDatabase();
    expect(() => closeDatabase()).not.toThrow();
  });

  it('migrate is idempotent', () => {
    const db = openDatabase('/r', { dataDir: tmp() });
    expect(() => migrate(db)).not.toThrow();
  });
});

describe('conversations CRUD', () => {
  function freshDb(): SqliteDb {
    const db = openDatabase('/r', { dataDir: tmp() });
    seedProject(db);
    return db;
  }

  it('inserts and reads back a conversation, defaulting title/sessionMode', () => {
    const db = freshDb();
    const created = insertConversation(db, { id: 'c1', projectId: 'p1', title: 'T', sessionMode: 'chat', createdAt: 10, updatedAt: 20 });
    expect(created).toMatchObject({ id: 'c1', projectId: 'p1', title: 'T', sessionMode: 'chat', messageCount: 0, createdAt: 10, updatedAt: 20 });

    // no title, no sessionMode -> title null, sessionMode default 'design'
    const bare = insertConversation(db, { id: 'c2', projectId: 'p1', createdAt: 1, updatedAt: 1 });
    expect(bare).toMatchObject({ title: null, sessionMode: 'design' });

    expect(getConversation(db, 'c1')).toMatchObject({ id: 'c1' });
    expect(getConversation(db, 'missing')).toBeNull();
  });

  it('normalizeConversationSessionMode coerces to a valid mode', () => {
    expect(normalizeConversationSessionMode('chat')).toBe('chat');
    expect(normalizeConversationSessionMode('plan')).toBe('plan');
    expect(normalizeConversationSessionMode('design')).toBe('design');
    expect(normalizeConversationSessionMode('bogus')).toBe('design');
    expect(normalizeConversationSessionMode(undefined)).toBe('design');
  });

  it('lists conversations with wall-clock run duration + message counts', () => {
    const db = freshDb();
    insertConversation(db, { id: 'c1', projectId: 'p1', createdAt: 1, updatedAt: 5 });
    seedMessage(db, { id: 'm0', cid: 'c1', role: 'user', position: 0 });
    seedMessage(db, { id: 'm1', cid: 'c1', role: 'assistant', position: 1, runStatus: 'succeeded', startedAt: 1000, endedAt: 1500 });

    const list = listConversations(db, 'p1');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: 'c1',
      messageCount: 2,
      latestRun: { status: 'succeeded', startedAt: 1000, endedAt: 1500, durationMs: 500 },
      totalDurationMs: 500,
    });
  });

  it('falls back to the latest usage-event duration when timestamps are absent', () => {
    const db = freshDb();
    insertConversation(db, { id: 'c1', projectId: 'p1', createdAt: 1, updatedAt: 5 });
    seedMessage(db, {
      id: 'm1', cid: 'c1', role: 'assistant', position: 0, runStatus: 'failed',
      startedAt: null, endedAt: null,
      eventsJson: JSON.stringify([{ kind: 'other' }, { kind: 'usage', durationMs: 300 }]),
    });
    const got = getConversation(db, 'c1');
    expect(got?.latestRun).toMatchObject({ status: 'failed', durationMs: 300 });
    expect(got?.totalDurationMs).toBe(300);
  });

  it('treats malformed / usage-less events as no duration', () => {
    const db = freshDb();
    insertConversation(db, { id: 'c1', projectId: 'p1', createdAt: 1, updatedAt: 5 });
    // malformed events_json + no timestamps -> latestUsageDurationMs catches, no durationMs
    seedMessage(db, { id: 'm1', cid: 'c1', role: 'assistant', position: 0, runStatus: 'canceled', eventsJson: 'not-json' });
    const got = getConversation(db, 'c1');
    expect(got?.latestRun).toMatchObject({ status: 'canceled' });
    expect(got?.latestRun?.durationMs).toBeUndefined();
    expect(got?.totalDurationMs).toBeUndefined();
  });

  it('ignores non-array and usage-less event payloads (no duration)', () => {
    const db = freshDb();
    // array with no usage event -> the scan loop completes without a match
    insertConversation(db, { id: 'ca', projectId: 'p1', createdAt: 1, updatedAt: 5 });
    seedMessage(db, { id: 'ma', cid: 'ca', role: 'assistant', position: 0, runStatus: 'failed', eventsJson: '[{"kind":"other"}]' });
    // valid JSON that is not an array -> rejected before the loop
    insertConversation(db, { id: 'cb', projectId: 'p1', createdAt: 1, updatedAt: 6 });
    seedMessage(db, { id: 'mb', cid: 'cb', role: 'assistant', position: 0, runStatus: 'failed', eventsJson: '{"kind":"usage","durationMs":9}' });

    expect(getConversation(db, 'ca')?.latestRun?.durationMs).toBeUndefined();
    expect(getConversation(db, 'cb')?.latestRun?.durationMs).toBeUndefined();
  });

  it('reports no latestRun for a conversation with no assistant runs', () => {
    const db = freshDb();
    insertConversation(db, { id: 'c1', projectId: 'p1', createdAt: 1, updatedAt: 5 });
    seedMessage(db, { id: 'm0', cid: 'c1', role: 'user', position: 0 }); // no run_status
    const list = listConversations(db, 'p1');
    expect(list[0].latestRun).toBeUndefined();
    expect(getConversation(db, 'c1')?.latestRun).toBeUndefined();
  });

  it('updates title + sessionMode, defaults updatedAt, and returns null for a missing id', () => {
    const db = freshDb();
    insertConversation(db, { id: 'c1', projectId: 'p1', title: 'A', sessionMode: 'design', createdAt: 1, updatedAt: 1 });

    const updated = updateConversation(db, 'c1', { title: 'B', sessionMode: 'plan', updatedAt: 99 });
    expect(updated).toMatchObject({ title: 'B', sessionMode: 'plan', updatedAt: 99 });

    // patch without sessionMode keeps the existing one; non-number updatedAt -> Date.now()
    const before = Date.now();
    const again = updateConversation(db, 'c1', { title: 'C' });
    expect(again).toMatchObject({ title: 'C', sessionMode: 'plan' });
    expect(again!.updatedAt).toBeGreaterThanOrEqual(before);

    expect(updateConversation(db, 'missing', { title: 'X' })).toBeNull();
  });

  it('persists a null title through update', () => {
    const db = freshDb();
    insertConversation(db, { id: 'c1', projectId: 'p1', createdAt: 1, updatedAt: 1 }); // no title
    const updated = updateConversation(db, 'c1', { sessionMode: 'chat' }); // patch has no title
    expect(updated).toMatchObject({ title: null, sessionMode: 'chat' });
  });

  it('deletes a conversation', () => {
    const db = freshDb();
    insertConversation(db, { id: 'c1', projectId: 'p1', createdAt: 1, updatedAt: 1 });
    deleteConversation(db, 'c1');
    expect(getConversation(db, 'c1')).toBeNull();
  });
});

describe('core helpers', () => {
  it('parseJsonOrUndef parses valid JSON and swallows everything else', () => {
    expect(parseJsonOrUndef('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonOrUndef('[1,2]')).toEqual([1, 2]);
    expect(parseJsonOrUndef('not json')).toBeUndefined();
    expect(parseJsonOrUndef('')).toBeUndefined();
    expect(parseJsonOrUndef(null)).toBeUndefined();
    expect(parseJsonOrUndef(42)).toBeUndefined();
  });

  it('row narrows a get() result to DbRow | null', () => {
    expect(row({ a: 1 })).toEqual({ a: 1 });
    expect(row(null)).toBeNull();
    expect(row('x')).toBeNull();
    expect(row(0)).toBeNull();
  });

  it('rows maps an all() result, replacing non-objects with {}', () => {
    expect(rows([{ a: 1 }, null, 'x'])).toEqual([{ a: 1 }, {}, {}]);
    expect(rows([])).toEqual([]);
  });
});
