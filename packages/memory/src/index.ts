/**
 * @module @jini/memory
 *
 * Generic daemon-side memory/notes capability: a frontmatter-backed note
 * store (`note-store.ts`), a bounded extraction-attempt log
 * (`extraction-log.ts`), a pure self-verify scorecard enforcer
 * (`verify.ts`), and a labeled-line rule-body parser (`rule-body.ts`). See
 * `source-map.md` for provenance and the scope decisions (what was
 * generalized vs. explicitly left OD-side).
 */
export type { EntryFrontmatter } from './entry-frontmatter.js';
export { parseEntryFrontmatter, renderEntryFrontmatter } from './entry-frontmatter.js';

export type { ParsedRuleBody } from './rule-body.js';
export { parseRuleBody } from './rule-body.js';

export type {
  NoteChangeEvent,
  NoteChangeKind,
  NoteEntry,
  NoteEntrySummary,
  NoteStore,
  NoteStoreConfig,
  NoteStoreOptions,
  NoteTreeNode,
} from './note-store.js';
export { createNoteStore } from './note-store.js';

export type { ExtractionLog, ExtractionPhase, ExtractionProvider, ExtractionRecord } from './extraction-log.js';
export { createExtractionLog } from './extraction-log.js';

export type {
  ActiveRuleForVerify,
  EnforceVerifyInput,
  VerifyLog,
  VerifyRecord,
  VerifyResult,
  VerifyScorecard,
  VerifyScorecardRow,
  VerifyStatus,
} from './verify.js';
export { createVerifyLog, enforceVerify } from './verify.js';
