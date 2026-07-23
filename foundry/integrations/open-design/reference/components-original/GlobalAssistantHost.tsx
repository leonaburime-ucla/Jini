import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { Button, VisuallyHidden } from '@open-design/components';
import { Icon } from './Icon';
import { ChatPane } from './ChatPane';
import { AvatarMenu } from './AvatarMenu';
import { useConversationChat } from './workspace/useConversationChat';
import { useI18n } from '../i18n';
import { getBrowserSessionId, getPrimaryAppSessionId } from '../providers/dom';
import {
  createWorkspaceConversation,
  deleteWorkspaceConversation,
  listWorkspaceConversations,
} from '../state/workspace';
import type { AgentInfo, AppConfig, Conversation, ExecMode } from '../types';
import type { WorkspaceConversation } from '@open-design/contracts';
import styles from './GlobalAssistantHost.module.css';

export const RESUME_CONVERSATION_ID_KEY = 'od:workspace-assistant:conversation-id';
const VIEW_MODE_KEY = 'od:workspace-assistant:view-mode';
// Kept in sync with .drawer's width in GlobalAssistantHost.module.css.
const PANEL_WIDTH_PX = '440px';
export const ASSISTANT_WINDOW_PATH = '/assistant-window';
const ASSISTANT_WINDOW_TARGET = 'od-assistant-window';

type ViewMode = 'overlay' | 'squish';

function isViewMode(value: string | null): value is ViewMode {
  return value === 'overlay' || value === 'squish';
}

interface FabPosition {
  left: number;
  top: number;
}

const FAB_POSITION_KEY = 'od:workspace-assistant:fab-position';
// Matches .fab's width/height in GlobalAssistantHost.module.css.
const FAB_SIZE = 52;
const FAB_VIEWPORT_MARGIN = 8;
const FAB_DEFAULT_EDGE_MARGIN = 24;

function loadFabPosition(): FabPosition | null {
  try {
    const raw = window.localStorage.getItem(FAB_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed && typeof parsed === 'object'
      && typeof (parsed as FabPosition).left === 'number'
      && typeof (parsed as FabPosition).top === 'number'
    ) {
      return parsed as FabPosition;
    }
  } catch {
    // Corrupt/foreign value — fall through to the default corner.
  }
  return null;
}

function defaultFabPosition(): FabPosition {
  return {
    left: window.innerWidth - FAB_SIZE - FAB_DEFAULT_EDGE_MARGIN,
    top: window.innerHeight - FAB_SIZE - FAB_DEFAULT_EDGE_MARGIN,
  };
}

function clampFabPosition(pos: FabPosition): FabPosition {
  const maxLeft = Math.max(FAB_VIEWPORT_MARGIN, window.innerWidth - FAB_SIZE - FAB_VIEWPORT_MARGIN);
  const maxTop = Math.max(FAB_VIEWPORT_MARGIN, window.innerHeight - FAB_SIZE - FAB_VIEWPORT_MARGIN);
  return {
    left: Math.min(Math.max(pos.left, FAB_VIEWPORT_MARGIN), maxLeft),
    top: Math.min(Math.max(pos.top, FAB_VIEWPORT_MARGIN), maxTop),
  };
}

// A drag beyond this many px (in either axis) counts as "the user dragged the
// FAB", suppressing the click that would otherwise open/close the panel —
// without this, every drag would also toggle the panel on release.
const FAB_DRAG_CLICK_THRESHOLD_PX = 4;

// Shared by GlobalAssistantHost (in-page panel) and the detached
// /assistant-window: both must resume the SAME workspace conversation, keyed
// off the same localStorage id (same origin, same browser profile). Resolves
// once per mount: remembered id -> most recent workspace conversation ->
// create a fresh one.
function useResolvedWorkspaceConversationId(active: boolean) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const resolveStartedRef = useRef(false);

  useEffect(() => {
    if (!active || resolveStartedRef.current) return;
    resolveStartedRef.current = true;
    setResolving(true);
    void (async () => {
      try {
        const remembered = window.localStorage.getItem(RESUME_CONVERSATION_ID_KEY);
        if (remembered) {
          setConversationId(remembered);
          return;
        }
        const existing = await listWorkspaceConversations();
        const mostRecent = existing[0] ?? null;
        if (mostRecent) {
          window.localStorage.setItem(RESUME_CONVERSATION_ID_KEY, mostRecent.id);
          setConversationId(mostRecent.id);
          return;
        }
        const created = await createWorkspaceConversation({ sessionMode: 'chat' });
        if (created) {
          window.localStorage.setItem(RESUME_CONVERSATION_ID_KEY, created.id);
          setConversationId(created.id);
        }
      } finally {
        setResolving(false);
      }
    })();
  }, [active]);

  return { conversationId, resolving };
}

// A workspace conversation shape sits one field short of `Conversation`
// (ChatPane's list prop) — it has no `projectId`, since it isn't bound to
// one. ChatPane's own list rendering never reads `.projectId` off a
// conversation item (only `id`, `title`, `messageCount`, `updatedAt`,
// `latestRun`), so an empty placeholder here is safe: it satisfies the type
// without ChatPane ever acting on it.
function toChatPaneConversation(c: WorkspaceConversation): Conversation {
  return {
    id: c.id,
    projectId: '',
    title: c.title,
    sessionMode: c.sessionMode,
    messageCount: c.messageCount,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

// Full conversation list + switch/create/delete for the in-page panel (the
// detached window stays on the simpler auto-resolve-only hook above — it has
// no view-mode switch or conversation list UI of its own). Mirrors the same
// resume-by-localStorage-id behavior on first open, but keeps every
// workspace conversation in state afterward so ChatPane's history list is
// real instead of the permanently-empty placeholder this used to pass.
function useWorkspaceConversations(active: boolean) {
  const [conversations, setConversations] = useState<WorkspaceConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const resolveStartedRef = useRef(false);

  const refresh = useCallback(async () => {
    const list = await listWorkspaceConversations();
    setConversations(list);
    return list;
  }, []);

  useEffect(() => {
    if (!active || resolveStartedRef.current) return;
    resolveStartedRef.current = true;
    setResolving(true);
    void (async () => {
      try {
        const list = await refresh();
        const remembered = window.localStorage.getItem(RESUME_CONVERSATION_ID_KEY);
        if (remembered && list.some((c) => c.id === remembered)) {
          setConversationId(remembered);
          return;
        }
        const mostRecent = list[0] ?? null;
        if (mostRecent) {
          window.localStorage.setItem(RESUME_CONVERSATION_ID_KEY, mostRecent.id);
          setConversationId(mostRecent.id);
          return;
        }
        const created = await createWorkspaceConversation({ sessionMode: 'chat' });
        if (created) {
          window.localStorage.setItem(RESUME_CONVERSATION_ID_KEY, created.id);
          setConversationId(created.id);
          setConversations([created]);
        }
      } finally {
        setResolving(false);
      }
    })();
  }, [active, refresh]);

  const selectConversation = useCallback((id: string) => {
    window.localStorage.setItem(RESUME_CONVERSATION_ID_KEY, id);
    setConversationId(id);
  }, []);

  const startNewConversation = useCallback(async () => {
    const created = await createWorkspaceConversation({ sessionMode: 'chat' });
    if (!created) return;
    window.localStorage.setItem(RESUME_CONVERSATION_ID_KEY, created.id);
    setConversationId(created.id);
    setConversations((curr) => [created, ...curr.filter((c) => c.id !== created.id)]);
  }, []);

  const removeConversation = useCallback(
    async (id: string) => {
      const ok = await deleteWorkspaceConversation(id);
      if (!ok) return;
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (conversationId !== id) return;
      // Deleted the active conversation — fall back to the next most recent,
      // or spin up a fresh one if that was the last conversation.
      const next = remaining[0] ?? (await createWorkspaceConversation({ sessionMode: 'chat' }));
      if (next) {
        window.localStorage.setItem(RESUME_CONVERSATION_ID_KEY, next.id);
        setConversationId(next.id);
        setConversations((curr) => (curr.some((c) => c.id === next.id) ? curr : [next, ...curr]));
      } else {
        window.localStorage.removeItem(RESUME_CONVERSATION_ID_KEY);
        setConversationId(null);
      }
    },
    [conversations, conversationId],
  );

  return {
    conversations,
    conversationId,
    resolving,
    selectConversation,
    startNewConversation,
    removeConversation,
  };
}

// Chrome shared between the in-page drawer and the detached assistant
// window (AppInner's /assistant-window branch) — the same config/agents
// state and the same central handlers App.tsx already owns for ProjectView
// and EntryView, so the agent/model picker and MCP/plugins/connectors entry
// points behave identically everywhere they're rendered.
export interface AssistantChromeProps {
  config: AppConfig;
  agents: AgentInfo[];
  daemonLive: boolean;
  onModeChange: (mode: ExecMode) => void;
  onAgentChange: (id: string) => void;
  onAgentModelChange: (id: string, choice: { model?: string; reasoning?: string }) => void;
  onApiModelChange?: (model: string) => void;
  onOpenSettings: (section?: 'execution') => void;
  onRefreshAgents: () => void;
  onOpenMcpSettings: () => void;
  onBrowsePlugins: () => void;
  onOpenConnectors: () => void;
}

// The global assistant: a bottom-right FAB that opens a persistent panel
// hosting a workspace-scoped conversation (not bound to any project). Mounted
// once at the AppInner shell level (survives route changes) — see
// ADS-memory/reports/swarm-consensus/runs/2026-07-12-global-assistant-chat-scope-consensus-report.md
// for why this is a workspace-scoped conversation rather than a hidden
// project or a new daemon entity.
//
// Three view modes:
// - overlay: fixed panel sliding over the page, dimmed backdrop (default).
// - squish: same fixed panel, but `.workspace-shell` reserves space via a
//   `body.assistant-squish-open` class (shell.css) instead of being covered.
// - detach: not a persistent mode — opens AppInner's `/assistant-window`
//   branch in a real second window (same origin, same localStorage, so it
//   resumes the same conversation) and closes the in-page panel. That
//   window's own browser-actions prefer routing to the main app window (see
//   getPrimaryAppSessionId), not itself — it has no Open Design DOM of its
//   own to act on.
export type GlobalAssistantHostProps = AssistantChromeProps;

export function GlobalAssistantHost(props: GlobalAssistantHostProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = window.localStorage.getItem(VIEW_MODE_KEY);
    return isViewMode(saved) ? saved : 'overlay';
  });
  const [fabPosition, setFabPosition] = useState<FabPosition | null>(() => loadFabPosition());
  const fabDraggedRef = useRef(false);
  const {
    conversations,
    conversationId,
    resolving: resolvingConversation,
    selectConversation,
    startNewConversation,
    removeConversation,
  } = useWorkspaceConversations(open);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

  const handleFabDrag = useCallback((_event: unknown, info: PanInfo) => {
    if (
      Math.abs(info.offset.x) > FAB_DRAG_CLICK_THRESHOLD_PX
      || Math.abs(info.offset.y) > FAB_DRAG_CLICK_THRESHOLD_PX
    ) {
      fabDraggedRef.current = true;
    }
  }, []);

  const handleFabDragEnd = useCallback((_event: unknown, info: PanInfo) => {
    setFabPosition((prev) => {
      const base = prev ?? defaultFabPosition();
      const next = clampFabPosition({ left: base.left + info.offset.x, top: base.top + info.offset.y });
      window.localStorage.setItem(FAB_POSITION_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const handleFabClick = useCallback(() => {
    if (fabDraggedRef.current) {
      // The drag that just ended shouldn't also toggle the panel.
      fabDraggedRef.current = false;
      return;
    }
    if (open) handleClose();
    else handleOpen();
  }, [open, handleOpen, handleClose]);

  // Re-clamp a persisted position after a window resize (e.g. leaving
  // fullscreen) shrinks the viewport out from under it.
  useEffect(() => {
    function onResize() {
      setFabPosition((prev) => {
        if (!prev) return prev;
        const next = clampFabPosition(prev);
        if (next.left === prev.left && next.top === prev.top) return prev;
        window.localStorage.setItem(FAB_POSITION_KEY, JSON.stringify(next));
        return next;
      });
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const selectViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(VIEW_MODE_KEY, mode);
  }, []);

  const handleDetach = useCallback(() => {
    window.open(
      ASSISTANT_WINDOW_PATH,
      ASSISTANT_WINDOW_TARGET,
      'width=420,height=760,resizable=yes',
    );
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, handleClose]);

  // `.workspace-shell` (shell.css) reserves space for the panel only while
  // both the panel is open AND squish mode is selected — an overlay-mode
  // open panel must not push content, and a closed panel must never reserve
  // space regardless of the saved mode.
  useEffect(() => {
    const shouldSquish = open && viewMode === 'squish';
    document.documentElement.style.setProperty(
      '--assistant-panel-reserved-width',
      shouldSquish ? PANEL_WIDTH_PX : '0px',
    );
    return () => document.documentElement.style.setProperty('--assistant-panel-reserved-width', '0px');
  }, [open, viewMode]);

  return (
    <>
      <motion.div
        // Remounted (via key) after every committed drag so Motion's own
        // internal drag transform resets to zero instead of stacking on top
        // of the next render's explicit left/top — otherwise the two
        // combine and the layer drifts off-screen by roughly double the
        // drag distance on the very next drag.
        key={fabPosition ? `${fabPosition.left}:${fabPosition.top}` : 'default'}
        className={styles.fabDragLayer}
        style={fabPosition ? { left: fabPosition.left, top: fabPosition.top, right: 'auto', bottom: 'auto' } : undefined}
        drag
        dragMomentum={false}
        dragElastic={0}
        onDragStart={() => { fabDraggedRef.current = false; }}
        onDrag={handleFabDrag}
        onDragEnd={handleFabDragEnd}
      >
        <Button
          variant="primary"
          size="icon"
          className={styles.fab}
          onClick={handleFabClick}
          aria-expanded={open}
        >
          <Icon name={open ? 'close' : 'message-circle'} size={20} />
          <VisuallyHidden>{open ? t('workspaceAssistant.close') : t('workspaceAssistant.fabLabel')}</VisuallyHidden>
        </Button>
      </motion.div>
      {createPortal(
        <AnimatePresence>
          {open ? (
            <>
              {viewMode === 'overlay' ? (
                <motion.div
                  key="backdrop"
                  className={styles.backdrop}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
                  onClick={handleClose}
                />
              ) : null}
              <motion.div
                key="drawer"
                className={styles.drawer}
                role="dialog"
                aria-modal={viewMode === 'overlay' ? true : undefined}
                aria-label={t('workspaceAssistant.title')}
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              >
                <div className={styles.drawerHeader}>
                  <span className={styles.drawerTitle}>{t('workspaceAssistant.title')}</span>
                  <div className={styles.viewModeSwitch} role="group" aria-label={t('workspaceAssistant.viewMode')}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={viewMode === 'overlay' ? styles.viewModeActive : undefined}
                      aria-pressed={viewMode === 'overlay'}
                      onClick={() => selectViewMode('overlay')}
                    >
                      <Icon name="panel-left" size={15} />
                      <VisuallyHidden>{t('workspaceAssistant.viewModeOverlay')}</VisuallyHidden>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={viewMode === 'squish' ? styles.viewModeActive : undefined}
                      aria-pressed={viewMode === 'squish'}
                      onClick={() => selectViewMode('squish')}
                    >
                      <Icon name="layout" size={15} />
                      <VisuallyHidden>{t('workspaceAssistant.viewModeSquish')}</VisuallyHidden>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleDetach}>
                      <Icon name="external-link" size={15} />
                      <VisuallyHidden>{t('workspaceAssistant.viewModeDetach')}</VisuallyHidden>
                    </Button>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleClose}>
                    <Icon name="close" size={16} />
                    <VisuallyHidden>{t('workspaceAssistant.close')}</VisuallyHidden>
                  </Button>
                </div>
                <div className={styles.drawerBody}>
                  {conversationId ? (
                    <GlobalAssistantChatBody
                      conversationId={conversationId}
                      browserSessionId={getBrowserSessionId()}
                      conversations={conversations}
                      onSelectConversation={selectConversation}
                      onNewConversation={startNewConversation}
                      onDeleteConversation={removeConversation}
                      {...props}
                    />
                  ) : (
                    <div className={styles.loading}>
                      {resolvingConversation ? t('workspaceAssistant.loading') : null}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

interface GlobalAssistantChatBodyProps extends AssistantChromeProps {
  conversationId: string;
  browserSessionId: string;
  /** Omitted by the detached window, which has no conversation-switcher UI. */
  conversations?: WorkspaceConversation[];
  onSelectConversation?: (id: string) => void;
  onNewConversation?: () => void;
  onDeleteConversation?: (id: string) => void;
}

export function GlobalAssistantChatBody({
  conversationId,
  browserSessionId,
  conversations = [],
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  config,
  agents,
  daemonLive,
  onModeChange,
  onAgentChange,
  onAgentModelChange,
  onApiModelChange,
  onOpenSettings,
  onRefreshAgents,
  onOpenMcpSettings,
  onBrowsePlugins,
  onOpenConnectors,
}: GlobalAssistantChatBodyProps) {
  const { locale } = useI18n();
  const agentsById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const { messages, streaming, error, loading, onSend, onRetry, onStop } = useConversationChat(
    null,
    conversationId,
    { config, agentsById, locale, sessionMode: 'chat', browserSessionId },
  );

  const executionControls = (
    <AvatarMenu
      config={config}
      agents={agents}
      daemonLive={daemonLive}
      onModeChange={onModeChange}
      onAgentChange={onAgentChange}
      onAgentModelChange={onAgentModelChange}
      onApiModelChange={onApiModelChange}
      onOpenSettings={onOpenSettings}
      onRefreshAgents={onRefreshAgents}
      placement="up"
    />
  );

  return (
    <ChatPane
      messages={messages}
      streaming={streaming}
      loading={loading}
      error={error}
      projectId={null}
      projectFiles={[]}
      onEnsureProject={async () => null}
      conversations={conversations.map(toChatPaneConversation)}
      activeConversationId={conversationId}
      onSelectConversation={onSelectConversation ?? (() => {})}
      onNewConversation={onNewConversation}
      onDeleteConversation={onDeleteConversation ?? (() => {})}
      onSend={onSend}
      onRetry={onRetry}
      onStop={onStop}
      config={config}
      composerFooterAccessory={executionControls}
      onOpenMcpSettings={onOpenMcpSettings}
      onBrowsePlugins={onBrowsePlugins}
      onOpenConnectors={onOpenConnectors}
    />
  );
}

// Rendered by AppInner when `window.location.pathname === ASSISTANT_WINDOW_PATH`
// — a real second window (opened via GlobalAssistantHost's detach button),
// same origin so it shares localStorage and resumes the same workspace
// conversation. Fills its whole window; no FAB, no backdrop, no view-mode
// switch (there's nothing to switch to from inside the detached window
// itself — closing the window is the way back to the in-page panel).
export function DetachedAssistantWindow(props: AssistantChromeProps) {
  const { t } = useI18n();
  const { conversationId, resolving } = useResolvedWorkspaceConversationId(true);
  return (
    <div className={styles.detachedWindow}>
      {conversationId ? (
        <GlobalAssistantChatBody
          conversationId={conversationId}
          browserSessionId={getPrimaryAppSessionId()}
          {...props}
        />
      ) : (
        <div className={styles.loading}>{resolving ? t('workspaceAssistant.loading') : null}</div>
      )}
    </div>
  );
}
