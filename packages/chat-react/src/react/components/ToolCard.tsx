/**
 * @module ToolCard
 *
 * Renders a single `tool_use` (optionally paired with its `tool_result`) as
 * an inline card. Lookup order: (1) a user-registered renderer
 * (`registerToolRenderer` — `../../tool-renderer-registry.js`), (2) a
 * hardcoded family card for tools shipped with this package (TodoWrite /
 * Write / Edit / Read / Bash / Glob / Grep / WebFetch / WebSearch), (3) a
 * generic command/output fallback.
 *
 * Ported from OD's `components/ToolCard.tsx` (verified 0 OD product
 * references) — `op-*` classNames and structure kept verbatim (this package
 * ships unstyled semantic markup; a host supplies CSS), every user-facing
 * string wrapped in `useT()`. The legacy `AskUserQuestion` read-only-history
 * card and its `op-generic`-shaped answer-recovery parsing are intentionally
 * NOT ported: that mechanism only exists in OD's persisted chat history
 * pre-dating the `<question-form>` flow, which is out of scope for a fresh
 * `@jini/chat-react` consumer — an unrecognized tool name (including
 * `AskUserQuestion`) falls through to `GenericCard`, which is a correct,
 * generic rendering for it.
 */
import { useState } from 'react';
import type { AgentEvent } from '@jini/chat-core';
import { isTodoWriteToolName, parseTodoWriteInput, toRenderProps } from '@jini/chat-core';
import { useT } from '../hooks/context.js';
import { getToolRenderer } from '../../tool-renderer-registry.js';
import { Icon } from './Icon.js';
import { TodoCard } from './TodoCard.js';

type ToolUseEvent = Extract<AgentEvent, { kind: 'tool_use' }>;
type ToolResultEvent = Extract<AgentEvent, { kind: 'tool_result' }>;

export interface ToolCardProps {
  use: ToolUseEvent;
  result?: ToolResultEvent | undefined;
  /** Whether the owning run is still streaming. Forwarded to registered renderers via `status`. */
  runStreaming?: boolean;
  /** Whether the owning run reached a successful terminal status. Missing tool results in a succeeded run render as done. */
  runSucceeded?: boolean;
  /** Basenames known to exist in the host's project/workspace — gates the "open" affordance on file-shaped tools. Omit to always show it. */
  projectFileNames?: Set<string>;
  /** Lifts a basename up to the host so it can focus the matching tab in its own file viewer. */
  onRequestOpenFile?: (name: string) => void;
}

export function ToolCard({ use, result, runStreaming, runSucceeded, projectFileNames, onRequestOpenFile }: ToolCardProps) {
  const name = use.name;
  const isStreaming = runStreaming ?? false;
  const isSucceeded = runSucceeded ?? false;
  const custom = getToolRenderer(name);
  if (custom) {
    try {
      const node = custom(toRenderProps(use, result, isStreaming, isSucceeded));
      if (node !== undefined && node !== null && node !== false) return <>{node}</>;
    } catch (err) {
      console.error(`[ToolCard] custom renderer for "${name}" threw; falling back`, err);
    }
  }
  const ctx: FileToolCtx = { projectFileNames, onRequestOpenFile };
  if (isTodoWriteToolName(name)) return <TodoCard todos={parseTodoWriteInput(use.input)} runStreaming={isStreaming} />;
  if (name === 'Write' || name === 'write' || name === 'create_file') return <FileWriteCard input={use.input} result={result} runStreaming={isStreaming} runSucceeded={isSucceeded} ctx={ctx} />;
  if (name === 'Edit' || name === 'str_replace_edit') return <FileEditCard input={use.input} result={result} runStreaming={isStreaming} runSucceeded={isSucceeded} ctx={ctx} />;
  if (name === 'Read' || name === 'read_file') return <FileReadCard input={use.input} result={result} runStreaming={isStreaming} runSucceeded={isSucceeded} ctx={ctx} />;
  if (name === 'Bash') return <BashCard input={use.input} result={result} runStreaming={isStreaming} runSucceeded={isSucceeded} />;
  if (name === 'Glob' || name === 'list_files') return <GlobCard input={use.input} result={result} runStreaming={isStreaming} runSucceeded={isSucceeded} />;
  if (name === 'Grep') return <GrepCard input={use.input} result={result} runStreaming={isStreaming} runSucceeded={isSucceeded} />;
  if (name === 'WebFetch' || name === 'web_fetch') return <WebFetchCard input={use.input} result={result} runStreaming={isStreaming} runSucceeded={isSucceeded} />;
  if (name === 'WebSearch' || name === 'web_search') return <WebSearchCard input={use.input} result={result} runStreaming={isStreaming} runSucceeded={isSucceeded} />;
  return <GenericCard name={name} input={use.input} result={result} runStreaming={isStreaming} runSucceeded={isSucceeded} />;
}

interface FileToolCtx {
  projectFileNames?: Set<string> | undefined;
  onRequestOpenFile?: ((name: string) => void) | undefined;
}

function OpenInTabButton({ filePath, ctx }: { filePath: string; ctx: FileToolCtx }) {
  const t = useT();
  if (!ctx.onRequestOpenFile) return null;
  if (!filePath || filePath === '(unnamed)') return null;
  // `String.prototype.split` always returns a non-empty array, so `.pop()` on it can
  // never be `undefined` here — the `??` fallback TS's return type demands is dead code.
  const baseName = filePath.split('/').pop()!;
  if (!baseName) return null;
  if (ctx.projectFileNames && !ctx.projectFileNames.has(baseName)) return null;
  const open = ctx.onRequestOpenFile;
  return (
    <button type="button" className="op-open" onClick={() => open(baseName)} title={t('Open {name} in a tab', { name: baseName })}>
      {t('Open')}
    </button>
  );
}

interface CardProps {
  input: unknown;
  result?: ToolResultEvent | undefined;
  runStreaming: boolean;
  runSucceeded: boolean;
}

function FileWriteCard({ input, result, runStreaming, runSucceeded, ctx }: CardProps & { ctx: FileToolCtx }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const obj = (input ?? {}) as { file_path?: string; filePath?: string; path?: string; content?: string };
  const file = obj.file_path ?? obj.filePath ?? obj.path ?? '(unnamed)';
  // See OpenInTabButton's baseName comment: `.split('/').pop()` is never undefined.
  const baseName = file.split('/').pop()!;
  const lines = typeof obj.content === 'string' ? obj.content.split('\n').length : null;
  const isRunning = runStreaming && !result;
  return (
    <div className="op-card op-file">
      <button type="button" className="op-card-head" onClick={() => setOpen((o) => !o)}>
        <ResultBadge result={result} runStreaming={runStreaming} runSucceeded={runSucceeded} />
        <span className={`op-title${isRunning ? ' shimmer-text' : ''}`}>{t('Write')}</span>
        <span className="op-meta">
          {baseName}
          {lines !== null ? ` · ${t('{n} lines', { n: lines })}` : ''}
        </span>
        <span className="op-expand-chev" aria-hidden>
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={11} />
        </span>
      </button>
      <div className={`accordion-collapsible${open ? ' open' : ''}`}>
        <div className="accordion-collapsible-inner">
          <div className="op-card-detail op-card-file-detail">
            <code className="op-path">{file}</code>
            <OpenInTabButton filePath={file} ctx={ctx} />
          </div>
        </div>
      </div>
      <FileErrorDetail result={result} />
    </div>
  );
}

function FileEditCard({ input, result, runStreaming, runSucceeded, ctx }: CardProps & { ctx: FileToolCtx }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const obj = (input ?? {}) as { file_path?: string; filePath?: string; path?: string; edits?: { old_string?: string; new_string?: string }[] };
  const file = obj.file_path ?? obj.filePath ?? obj.path ?? '(unnamed)';
  // See OpenInTabButton's baseName comment: `.split('/').pop()` is never undefined.
  const baseName = file.split('/').pop()!;
  const editCount = Array.isArray(obj.edits) ? obj.edits.length : 1;
  const isRunning = runStreaming && !result;
  return (
    <div className="op-card op-file">
      <button type="button" className="op-card-head" onClick={() => setOpen((o) => !o)}>
        <ResultBadge result={result} runStreaming={runStreaming} runSucceeded={runSucceeded} />
        <span className={`op-title${isRunning ? ' shimmer-text' : ''}`}>{t('Edit')}</span>
        <span className="op-meta">
          {baseName} · {editCount} {editCount === 1 ? t('change') : t('changes')}
        </span>
        <span className="op-expand-chev" aria-hidden>
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={11} />
        </span>
      </button>
      <div className={`accordion-collapsible${open ? ' open' : ''}`}>
        <div className="accordion-collapsible-inner">
          <div className="op-card-detail op-card-file-detail">
            <code className="op-path">{file}</code>
            <OpenInTabButton filePath={file} ctx={ctx} />
          </div>
        </div>
      </div>
      <FileErrorDetail result={result} />
    </div>
  );
}

function FileReadCard({ input, result, runStreaming, runSucceeded, ctx }: CardProps & { ctx: FileToolCtx }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const obj = (input ?? {}) as { file_path?: string; filePath?: string; path?: string };
  const file = obj.file_path ?? obj.filePath ?? obj.path ?? '(unnamed)';
  // See OpenInTabButton's baseName comment: `.split('/').pop()` is never undefined.
  const baseName = file.split('/').pop()!;
  const isRunning = runStreaming && !result;
  return (
    <div className="op-card op-file">
      <button type="button" className="op-card-head" onClick={() => setOpen((o) => !o)}>
        <ResultBadge result={result} runStreaming={runStreaming} runSucceeded={runSucceeded} />
        <span className={`op-title${isRunning ? ' shimmer-text' : ''}`}>{t('Read')}</span>
        <span className="op-meta">{baseName}</span>
        <span className="op-expand-chev" aria-hidden>
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={11} />
        </span>
      </button>
      <div className={`accordion-collapsible${open ? ' open' : ''}`}>
        <div className="accordion-collapsible-inner">
          <div className="op-card-detail op-card-file-detail">
            <code className="op-path">{file}</code>
            <OpenInTabButton filePath={file} ctx={ctx} />
          </div>
        </div>
      </div>
      <FileErrorDetail result={result} />
    </div>
  );
}

function BashCard({ input, result, runStreaming, runSucceeded }: CardProps) {
  const t = useT();
  const obj = (input ?? {}) as { command?: string; description?: string };
  const command = obj.command ?? '';
  const desc = obj.description;
  const [open, setOpen] = useState(false);
  const isRunning = runStreaming && !result;
  return (
    <div className="op-card op-bash">
      <button type="button" className="op-card-head" onClick={() => setOpen((o) => !o)}>
        <ResultBadge result={result} runStreaming={runStreaming} runSucceeded={runSucceeded} />
        <span className={`op-title${isRunning ? ' shimmer-text' : ''}`}>{t('Bash')}</span>
        {desc ? <span className="op-meta op-desc">{desc}</span> : null}
        <span className="op-expand-chev" aria-hidden>
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={11} />
        </span>
      </button>
      <div className={`accordion-collapsible${open ? ' open' : ''}`}>
        <div className="accordion-collapsible-inner">
          <div className="op-card-detail">
            <pre className="op-command">{truncate(command, 400)}</pre>
            {result?.content ? <pre className="op-output">{truncate(result.content, 4000)}</pre> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function GlobCard({ input, result, runStreaming, runSucceeded }: CardProps) {
  const t = useT();
  const obj = (input ?? {}) as { pattern?: string; path?: string };
  return (
    <div className="op-card op-search">
      <div className="op-card-head">
        <ResultBadge result={result} runStreaming={runStreaming} runSucceeded={runSucceeded} />
        <span className="op-title">{t('Search files')}</span>
        <span className="op-meta">
          {obj.pattern ?? '*'}
          {obj.path ? ` in ${obj.path}` : ''}
        </span>
      </div>
    </div>
  );
}

function GrepCard({ input, result, runStreaming, runSucceeded }: CardProps) {
  const t = useT();
  const obj = (input ?? {}) as { pattern?: string; path?: string };
  return (
    <div className="op-card op-search">
      <div className="op-card-head">
        <ResultBadge result={result} runStreaming={runStreaming} runSucceeded={runSucceeded} />
        <span className="op-title">{t('Search content')}</span>
        <span className="op-meta">
          {obj.pattern ?? ''}
          {obj.path ? ` in ${obj.path}` : ''}
        </span>
      </div>
    </div>
  );
}

function WebFetchCard({ input, result, runStreaming, runSucceeded }: CardProps) {
  const t = useT();
  const obj = (input ?? {}) as { url?: string };
  return (
    <div className="op-card op-web">
      <div className="op-card-head">
        <ResultBadge result={result} runStreaming={runStreaming} runSucceeded={runSucceeded} />
        <span className="op-title">{t('Fetch')}</span>
        <span className="op-meta">{obj.url ?? ''}</span>
      </div>
    </div>
  );
}

function WebSearchCard({ input, result, runStreaming, runSucceeded }: CardProps) {
  const t = useT();
  const obj = (input ?? {}) as { query?: string };
  return (
    <div className="op-card op-web">
      <div className="op-card-head">
        <ResultBadge result={result} runStreaming={runStreaming} runSucceeded={runSucceeded} />
        <span className="op-title">{t('Search')}</span>
        <span className="op-meta">{obj.query ?? ''}</span>
      </div>
    </div>
  );
}

function GenericCard({ name, input, result, runStreaming, runSucceeded }: CardProps & { name: string }) {
  const summary = describeInput(input);
  return (
    <div className="op-card op-generic">
      <div className="op-card-head">
        <ResultBadge result={result} runStreaming={runStreaming} runSucceeded={runSucceeded} />
        <span className="op-title">{name}</span>
        {summary ? <span className="op-meta">{truncate(summary, 200)}</span> : null}
      </div>
    </div>
  );
}

function ResultBadge({ result, runStreaming, runSucceeded }: { result?: ToolResultEvent | undefined; runStreaming: boolean; runSucceeded: boolean }) {
  const t = useT();
  if (!result && runStreaming)
    return (
      <span className="op-status op-status-running" title={t('Running')}>
        <Icon name="spinner" size={14} />
      </span>
    );
  if (!result && !runSucceeded)
    return (
      <span className="op-status op-status-error" title={t('Error')}>
        <Icon name="close" size={14} />
      </span>
    );
  if (result?.isError)
    return (
      <span className="op-status op-status-error" title={result.content || t('Error')}>
        <Icon name="close" size={14} />
      </span>
    );
  return (
    <span className="op-status op-status-ok" title={t('Done')}>
      <Icon name="check" size={14} />
    </span>
  );
}

function FileErrorDetail({ result }: { result?: ToolResultEvent | undefined }) {
  if (!result?.isError || !result.content.trim()) return null;
  return <pre className="op-output">{truncate(result.content, 1200)}</pre>;
}

function describeInput(input: unknown): string {
  if (input == null) return '';
  if (typeof input === 'string') return input;
  if (typeof input !== 'object') return String(input);
  const obj = input as Record<string, unknown>;
  for (const key of ['file_path', 'path', 'pattern', 'url', 'query', 'name', 'command']) {
    const v = obj[key];
    if (typeof v === 'string') return v;
  }
  try {
    return JSON.stringify(obj);
  } catch {
    return '';
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
