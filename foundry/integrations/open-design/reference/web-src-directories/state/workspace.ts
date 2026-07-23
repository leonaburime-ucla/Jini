import type {
  ChatMessage,
  ChatSessionMode,
  WorkspaceConversation,
  WorkspaceConversationResponse,
  WorkspaceConversationsResponse,
} from '@open-design/contracts';
import type { SaveMessageOptions } from './projects';

// Project-unbound counterpart to the conversation/message functions in
// state/projects.ts -- same shapes, hits /api/workspace/conversations
// instead of /api/projects/:id/conversations. See useConversationChat.ts,
// which branches between the two based on whether it was given a projectId.

export async function listWorkspaceConversations(): Promise<WorkspaceConversation[]> {
  try {
    const resp = await fetch('/api/workspace/conversations');
    if (!resp.ok) return [];
    const json = (await resp.json()) as WorkspaceConversationsResponse;
    return json.conversations ?? [];
  } catch {
    return [];
  }
}

export async function createWorkspaceConversation(
  opts: { title?: string | null; sessionMode?: ChatSessionMode } = {},
): Promise<WorkspaceConversation | null> {
  try {
    const resp = await fetch('/api/workspace/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as WorkspaceConversationResponse;
    return json.conversation ?? null;
  } catch {
    return null;
  }
}

export async function deleteWorkspaceConversation(conversationId: string): Promise<boolean> {
  try {
    const resp = await fetch(`/api/workspace/conversations/${encodeURIComponent(conversationId)}`, {
      method: 'DELETE',
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function listWorkspaceMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const resp = await fetch(`/api/workspace/conversations/${encodeURIComponent(conversationId)}/messages`);
    if (!resp.ok) return [];
    const json = (await resp.json()) as { messages: ChatMessage[] };
    return json.messages ?? [];
  } catch {
    return [];
  }
}

export async function saveWorkspaceMessage(
  conversationId: string,
  message: ChatMessage,
  options: SaveMessageOptions = {},
): Promise<void> {
  try {
    const body = options.telemetryFinalized
      ? { ...message, telemetryFinalized: true }
      : message;
    await fetch(
      `/api/workspace/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(message.id)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        ...(options.keepalive ? { keepalive: true } : {}),
      },
    );
  } catch {
    // best-effort persistence — UI keeps the message in-memory either way
  }
}
