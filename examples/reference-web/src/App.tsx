import { useEffect, useMemo, useState } from 'react';
import type { ChatMessage } from '@jini/chat-core';
import { Composer, MessageList, useComposer, useConversation } from '@jini/chat-react';
import { createDaemonChatTransport } from './daemon-transport.js';

interface SampleProject {
  id: 'starter-site' | 'bug-hunt';
  name: string;
  eyebrow: string;
  description: string;
  accent: string;
  files: string[];
  prompts: string[];
}

interface AgentSummary {
  id: string;
  name: string;
}

const PROJECTS: SampleProject[] = [
  {
    id: 'starter-site',
    name: 'Starter Site',
    eyebrow: 'Browser project',
    description: 'A small, zero-dependency task board ready for visual changes.',
    accent: '#e86f51',
    files: ['index.html', 'styles.css', 'app.js', 'README.md'],
    prompts: [
      'Inspect this project and suggest one useful improvement.',
      'Add a filter for completed items while preserving the visual style.',
    ],
  },
  {
    id: 'bug-hunt',
    name: 'Bug Hunt',
    eyebrow: 'Test project',
    description: 'A focused JavaScript defect with a failing Node test.',
    accent: '#7b61c9',
    files: ['src/cart.js', 'test/cart.test.js', 'README.md'],
    prompts: [
      'Run the tests, explain the failure, and fix only the bug.',
      'Review the cart calculation for edge cases without changing its API.',
    ],
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Welcome to **Jini Playground**. Pick a sample project, then ask me to inspect it. Demo mode uses the real daemon and event stream without requiring an account.',
    runStatus: 'succeeded',
    createdAt: Date.now(),
  },
];

function shellName(): string {
  return new URLSearchParams(window.location.search).get('shell') === 'desktop' ? 'Desktop' : 'Chrome';
}

function AppChat({
  project,
  runtimeId,
  onActivity,
}: {
  project: SampleProject;
  runtimeId: string;
  onActivity: (label: string) => void;
}) {
  const transport = useMemo(() => createDaemonChatTransport(), []);
  const conversation = useConversation({ transport, initialMessages: INITIAL_MESSAGES });
  const composer = useComposer();

  const send = () => {
    const prompt = composer.draft.trim();
    if (!prompt || conversation.isStreaming) return;
    composer.reset();
    onActivity('Run queued');
    void conversation
      .sendMessage(prompt, {
        agentId: runtimeId,
        context: { project: project.id },
      })
      .then(() => onActivity('Streaming'))
      .catch(() => onActivity('Run failed'));
  };

  useEffect(() => {
    if (conversation.error) onActivity('Run failed');
    else if (conversation.isStreaming) onActivity('Streaming');
    else if (conversation.messages.some((message) => message.runStatus === 'succeeded')) onActivity('Ready');
  }, [conversation.error, conversation.isStreaming, conversation.messages, onActivity]);

  return (
    <>
      <div className="chat-heading">
        <div>
          <span className="section-kicker">Workspace conversation</span>
          <h1>{project.name}</h1>
        </div>
        <button className="quiet-button" type="button" onClick={() => conversation.setMessages(INITIAL_MESSAGES)}>
          New thread
        </button>
      </div>

      <div className="chat-stage">
        <MessageList
          messages={conversation.messages}
          isStreaming={conversation.isStreaming}
          scrollIntent={conversation.scrollIntent}
          onScrolled={conversation.acknowledgeScroll}
          projectFileNames={new Set(project.files)}
        />
      </div>

      <div className="prompt-suggestions" aria-label="Example prompts">
        {project.prompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => composer.setDraft(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      {conversation.error ? <div className="run-error">{conversation.error.message}</div> : null}
      <div className="composer-wrap">
        <Composer
          composer={composer}
          onSend={send}
          disabled={conversation.isStreaming}
          placeholder={`Ask Jini about ${project.name}…`}
        />
        {conversation.isStreaming ? (
          <button className="cancel-run" type="button" onClick={conversation.cancel}>
            Stop run
          </button>
        ) : null}
      </div>
    </>
  );
}

export function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<SampleProject['id']>('starter-site');
  const [runtimeId, setRuntimeId] = useState('playground-demo');
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [daemonOnline, setDaemonOnline] = useState(false);
  const [activity, setActivity] = useState('Connecting');
  const shell = shellName();
  const selectedProject = PROJECTS.find((project) => project.id === selectedProjectId) ?? PROJECTS[0]!;

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const [statusResponse, agentsResponse] = await Promise.all([
          fetch('/api/daemon/status'),
          fetch('/api/agents'),
        ]);
        if (!statusResponse.ok) throw new Error('daemon unavailable');
        const status = (await statusResponse.json()) as { ok?: boolean };
        const agentBody = agentsResponse.ok ? ((await agentsResponse.json()) as { agents?: AgentSummary[] }) : {};
        if (alive) {
          setDaemonOnline(status.ok === true);
          setAgents(agentBody.agents ?? []);
          setActivity('Ready');
        }
      } catch {
        if (alive) {
          setDaemonOnline(false);
          setActivity('Daemon offline');
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <main className="playground-shell">
      <aside className="project-rail">
        <div className="brand-lockup">
          <div className="brand-glyph" aria-hidden="true">
            J
          </div>
          <div>
            <strong>Jini</strong>
            <span>Agent control plane</span>
          </div>
        </div>

        <div className="rail-label">Sample workspaces</div>
        <nav className="project-list" aria-label="Sample workspaces">
          {PROJECTS.map((project) => (
            <button
              className={project.id === selectedProject.id ? 'project-card active' : 'project-card'}
              type="button"
              key={project.id}
              onClick={() => setSelectedProjectId(project.id)}
            >
              <span className="project-dot" style={{ background: project.accent }} />
              <span>
                <strong>{project.name}</strong>
                <small>{project.eyebrow}</small>
              </span>
              <span className="project-arrow">›</span>
            </button>
          ))}
        </nav>

        <div className="rail-note">
          <span>LOCAL WORKSPACE</span>
          <code>examples/sample-projects/</code>
        </div>
      </aside>

      <section className="conversation-pane">
        <header className="topbar">
          <div className="crumbs">
            <span>Playground</span>
            <b>/</b>
            <strong>{selectedProject.name}</strong>
          </div>
          <div className="topbar-status">
            <span className={daemonOnline ? 'status-light online' : 'status-light'} />
            {daemonOnline ? 'Daemon connected' : 'Daemon offline'}
          </div>
        </header>

        <AppChat project={selectedProject} runtimeId={runtimeId} onActivity={setActivity} />
      </section>

      <aside className="inspector">
        <div className="inspector-head">
          <span className="section-kicker">Run inspector</span>
          <span className="shell-pill">{shell}</span>
        </div>

        <section className="runtime-card">
          <label htmlFor="runtime">Runtime</label>
          <select id="runtime" value={runtimeId} onChange={(event) => setRuntimeId(event.target.value)}>
            <option value="playground-demo">Jini Demo · no key</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <p>
            {runtimeId === 'playground-demo'
              ? 'Deterministic events through the real daemon.'
              : 'Uses the installed local agent CLI and this sample workspace.'}
          </p>
        </section>

        <section className="activity-card">
          <div className="activity-row">
            <span>Current state</span>
            <strong>{activity}</strong>
          </div>
          <div className="activity-row">
            <span>Transport</span>
            <strong>HTTP + SSE</strong>
          </div>
          <div className="activity-row">
            <span>Surface</span>
            <strong>{shell}</strong>
          </div>
        </section>

        <section className="project-detail">
          <div className="project-detail-title">
            <span className="project-dot large" style={{ background: selectedProject.accent }} />
            <div>
              <strong>{selectedProject.name}</strong>
              <span>{selectedProject.description}</span>
            </div>
          </div>
          <div className="file-tree">
            {selectedProject.files.map((file) => (
              <div key={file}>
                <span>⌁</span>
                <code>{file}</code>
              </div>
            ))}
          </div>
        </section>

        <section className="parity-card">
          <span className="section-kicker">Parity slice</span>
          <ul>
            <li>
              <i className="check">✓</i> Shared Chrome / desktop renderer
            </li>
            <li>
              <i className="check">✓</i> Durable daemon runs
            </li>
            <li>
              <i className="check">✓</i> Streaming tool timeline
            </li>
            <li>
              <i>○</i> Artifact canvas integration
            </li>
          </ul>
        </section>
      </aside>
    </main>
  );
}
