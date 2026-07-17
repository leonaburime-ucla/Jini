import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useArtifactStream } from './useArtifactStream.js';
import { RendererRegistry } from '../../artifact-types.js';

describe('useArtifactStream', () => {
  it('returns no items for content with no artifact', () => {
    const { result } = renderHook(() => useArtifactStream('just some prose'));
    expect(result.current.items).toEqual([]);
    expect(result.current.current).toBeNull();
  });

  it('extracts a completed artifact and resolves it against the registry', () => {
    const registry = new RendererRegistry();
    registry.register({ id: 'html', supportsStreaming: true, canRender: (ctx) => ctx.file.kind === 'text/html' });
    const content = 'Here you go:\n<artifact identifier="page" type="text/html" title="Landing">\n<h1>Hi</h1>\n</artifact>\nDone.';
    const { result } = renderHook(() => useArtifactStream(content, registry));
    expect(result.current.items).toHaveLength(1);
    const item = result.current.items[0]!;
    expect(item.status).toBe('complete');
    expect(item.identifier).toBe('page');
    expect(item.content).toContain('<h1>Hi</h1>');
    expect(item.match?.renderer.id).toBe('html');
    expect(result.current.current).toBe(item);
  });

  it('surfaces a still-streaming artifact (no close tag yet) as status streaming', () => {
    const content = '<artifact identifier="live" type="text/html" title="Live">\n<p>partial';
    const { result } = renderHook(() => useArtifactStream(content));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.status).toBe('streaming');
    expect(result.current.items[0]?.content).toContain('partial');
  });

  it('is stable (memoized) across re-renders with the same content and registry', () => {
    const registry = new RendererRegistry();
    const content = 'no artifact here';
    const { result, rerender } = renderHook(({ c }) => useArtifactStream(c, registry), { initialProps: { c: content } });
    const first = result.current;
    rerender({ c: content });
    expect(result.current).toBe(first);
  });
});
