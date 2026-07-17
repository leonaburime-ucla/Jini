import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatAttachment } from '@jini/chat-core';
import { useComposer } from './useComposer.js';
import type { ProjectContextValue } from '../../slots.js';

describe('useComposer', () => {
  it('tracks draft text and canSubmit', () => {
    const { result } = renderHook(() => useComposer());
    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.setDraft('hello'));
    expect(result.current.draft).toBe('hello');
    expect(result.current.canSubmit).toBe(true);
  });

  it('persists draft writes through an injected persistence port, and seeds from it', () => {
    const store = { value: 'seeded draft' };
    const persistence = { read: () => store.value, write: (v: string) => (store.value = v) };
    const { result } = renderHook(() => useComposer({ persistence }));
    expect(result.current.draft).toBe('seeded draft');
    act(() => result.current.setDraft('typed'));
    expect(store.value).toBe('typed');
  });

  it('addAttachments uploads via ProjectContextValue.uploadFiles and stages the results', async () => {
    const uploaded: ChatAttachment = { path: '/tmp/a.png', name: 'a.png', kind: 'image' };
    const uploadFiles = vi.fn().mockResolvedValue([uploaded]);
    const project: ProjectContextValue = { projectId: 'p1', files: [], resolveFileUrl: (p) => p, resolveRawUrl: (p) => p, uploadFiles };
    const { result } = renderHook(() => useComposer({ project }));
    const file = new File(['x'], 'a.png');
    await act(async () => {
      await result.current.addAttachments([file]);
    });
    expect(uploadFiles).toHaveBeenCalledWith([file]);
    expect(result.current.attachments).toEqual([uploaded]);
    expect(result.current.canSubmit).toBe(true);
  });

  it('addAttachments rejects when no upload port is wired', async () => {
    const { result } = renderHook(() => useComposer());
    await expect(result.current.addAttachments([new File(['x'], 'a.png')])).rejects.toThrow();
  });

  it('removeAttachment removes by path', () => {
    const { result } = renderHook(() => useComposer());
    act(() => result.current.addAttachment({ path: '/a', name: 'a', kind: 'file' }));
    act(() => result.current.addAttachment({ path: '/b', name: 'b', kind: 'file' }));
    expect(result.current.attachments).toHaveLength(2);
    act(() => result.current.removeAttachment('/a'));
    expect(result.current.attachments.map((a) => a.path)).toEqual(['/b']);
  });

  it('openMention queries every mention source and merges results', async () => {
    const { result } = renderHook(() =>
      useComposer({
        composerSlots: {
          mentionSources: [
            { id: 'skills', label: 'Skills', search: () => [{ id: 's1', label: 'brand-extract' }] },
            { id: 'files', label: 'Files', search: async () => [{ id: 'f1', label: 'index.html' }] },
          ],
        },
      }),
    );
    await act(async () => {
      await result.current.openMention('br');
    });
    await waitFor(() => expect(result.current.mention.results).toHaveLength(2));
    expect(result.current.mention.open).toBe(true);
  });

  it('selectMention inserts the mention into the draft and closes the popover', () => {
    const { result } = renderHook(() => useComposer({ initialDraft: 'check out ' }));
    act(() => result.current.selectMention({ id: 's1', label: 'brand-extract', insertText: '@brand-extract ' }));
    expect(result.current.draft).toBe('check out @brand-extract ');
    expect(result.current.mention.open).toBe(false);
  });

  it('reset() clears draft, attachments, and closes the mention popover', () => {
    const { result } = renderHook(() => useComposer({ initialDraft: 'x' }));
    act(() => result.current.addAttachment({ path: '/a', name: 'a', kind: 'file' }));
    act(() => result.current.reset());
    expect(result.current.draft).toBe('');
    expect(result.current.attachments).toEqual([]);
    expect(result.current.canSubmit).toBe(false);
  });

  it('setAgent updates the current agent selection', () => {
    const { result } = renderHook(() => useComposer());
    expect(result.current.agent).toBeUndefined();
    act(() => result.current.setAgent({ agentId: 'claude', model: 'sonnet' }));
    expect(result.current.agent).toEqual({ agentId: 'claude', model: 'sonnet' });
  });
});
