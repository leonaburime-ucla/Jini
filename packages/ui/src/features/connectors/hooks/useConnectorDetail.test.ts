import { act, renderHook, waitFor } from '@testing-library/react';
import type { Dispatch, SetStateAction } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useConnectorDetail } from './useConnectorDetail.js';
import { createFakeConnectorsPort } from '../dependencies.js';
import type { Connector } from '../types.js';

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return { id: 'slack', name: 'Slack', provider: 'Composio', category: 'communication', status: 'available', tools: [], ...overrides };
}

function makeSetConnectorsSpy(getCurrent: () => Connector[], setCurrent: (next: Connector[]) => void): Dispatch<SetStateAction<Connector[]>> {
  return vi.fn((next: SetStateAction<Connector[]>) => {
    setCurrent(typeof next === 'function' ? (next as (curr: Connector[]) => Connector[])(getCurrent()) : next);
  });
}

describe('useConnectorDetail', () => {
  it('openDetails sets detailConnectorId and derives detailConnector from the live catalog', () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector()] });
    const setConnectors = vi.fn();
    const { result } = renderHook(() =>
      useConnectorDetail(port, { connectors: [makeConnector()], setConnectors, unlocked: true, retryToken: 'a' }),
    );

    expect(result.current.detailConnector).toBeNull();
    act(() => result.current.openDetails('slack'));
    expect(result.current.detailConnectorId).toBe('slack');
    expect(result.current.detailConnector?.id).toBe('slack');
  });

  it('closeDetails clears the open connector', () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector()] });
    const setConnectors = vi.fn();
    const { result } = renderHook(() =>
      useConnectorDetail(port, { connectors: [makeConnector()], setConnectors, unlocked: true, retryToken: 'a' }),
    );
    act(() => result.current.openDetails('slack'));
    act(() => result.current.closeDetails());
    expect(result.current.detailConnectorId).toBeNull();
  });

  it('auto-hydrates tool preview once a connector with no advertised tools is opened, while unlocked', async () => {
    const connector = makeConnector({ toolCount: 2, tools: [] });
    const port = createFakeConnectorsPort({ connectors: [connector] });
    const fetchDetail = vi.fn(port.fetchConnectorDetail.bind(port));
    port.fetchConnectorDetail = fetchDetail;
    let connectors = [connector];
    const setConnectors = makeSetConnectorsSpy(
      () => connectors,
      (next) => {
        connectors = next;
      },
    );

    const { result, rerender } = renderHook(
      ({ conns }: { conns: Connector[] }) => useConnectorDetail(port, { connectors: conns, setConnectors, unlocked: true, retryToken: 'a' }),
      { initialProps: { conns: connectors } },
    );

    act(() => result.current.openDetails('slack'));
    await waitFor(() => expect(fetchDetail).toHaveBeenCalledWith('slack', { hydrateTools: true, toolsLimit: 50 }));
    rerender({ conns: connectors });
  });

  it('honors a caller-supplied toolsLimit instead of the default', async () => {
    const connector = makeConnector({ toolCount: 2, tools: [] });
    const port = createFakeConnectorsPort({ connectors: [connector] });
    const fetchDetail = vi.fn(port.fetchConnectorDetail.bind(port));
    port.fetchConnectorDetail = fetchDetail;
    const setConnectors = vi.fn();
    const { result } = renderHook(() =>
      useConnectorDetail(port, { connectors: [connector], setConnectors, unlocked: true, retryToken: 'a', toolsLimit: 10 }),
    );

    act(() => result.current.openDetails('slack'));
    await waitFor(() => expect(fetchDetail).toHaveBeenCalledWith('slack', { hydrateTools: true, toolsLimit: 10 }));
  });

  it('does not hydrate while locked', async () => {
    const connector = makeConnector({ toolCount: 2, tools: [] });
    const port = createFakeConnectorsPort({ connectors: [connector] });
    const fetchDetail = vi.fn(port.fetchConnectorDetail.bind(port));
    port.fetchConnectorDetail = fetchDetail;
    const setConnectors = vi.fn();
    const { result } = renderHook(() =>
      useConnectorDetail(port, { connectors: [connector], setConnectors, unlocked: false, retryToken: 'a' }),
    );

    act(() => result.current.openDetails('slack'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchDetail).not.toHaveBeenCalled();
  });

  it('does not re-fetch once already fully loaded (no next cursor, tools.length >= toolCount)', async () => {
    const connector = makeConnector({ toolCount: 1, tools: [{ name: 'a', safety: { sideEffect: 'no_side_effect' } }] });
    const port = createFakeConnectorsPort({ connectors: [connector] });
    const fetchDetail = vi.fn(port.fetchConnectorDetail.bind(port));
    port.fetchConnectorDetail = fetchDetail;
    const setConnectors = vi.fn();
    const { result } = renderHook(() =>
      useConnectorDetail(port, { connectors: [connector], setConnectors, unlocked: true, retryToken: 'a' }),
    );

    act(() => result.current.openDetails('slack'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchDetail).not.toHaveBeenCalled();
    expect(result.current.toolsLoaded).toBe(true);
  });

  it('loadMoreTools fetches the next cursor page and merges the result', async () => {
    // toolCount is intentionally larger than either page so
    // hasLoadedAllAdvertisedConnectorTools stays false throughout, matching
    // a real paginated catalog.
    const connector = makeConnector({ toolCount: 5, tools: [] });
    const port = createFakeConnectorsPort({ connectors: [] });
    port.fetchConnectorDetail = vi.fn(async (_id, options) => {
      if (options?.toolsCursor === 'cursor-1') {
        return { ...connector, tools: [{ name: 'b', safety: { sideEffect: 'no_side_effect' } }], toolsNextCursor: undefined as unknown as string };
      }
      return { ...connector, tools: [{ name: 'a', safety: { sideEffect: 'no_side_effect' } }], toolsNextCursor: 'cursor-1' };
    });
    let connectors = [connector];
    const setConnectors = makeSetConnectorsSpy(
      () => connectors,
      (next) => {
        connectors = next;
      },
    );
    const { result, rerender } = renderHook(
      ({ conns }: { conns: Connector[] }) => useConnectorDetail(port, { connectors: conns, setConnectors, unlocked: true, retryToken: 'a' }),
      { initialProps: { conns: connectors } },
    );

    // Opening the drawer auto-fetches page 1 (no cursor) first, same as the
    // real component — wait for it to settle before pagination.
    act(() => result.current.openDetails('slack'));
    await waitFor(() => expect(connectors[0]!.tools.map((t) => t.name)).toEqual(['a']));
    rerender({ conns: connectors });

    await act(async () => {
      await result.current.loadMoreTools('slack', 'cursor-1');
    });
    expect(connectors[0]!.tools.map((t) => t.name)).toEqual(['a', 'b']);
  });

  it('marks a failed fetch with the current retryToken, and does not retry until the token changes', async () => {
    const connector = makeConnector({ toolCount: 2, tools: [] });
    const port = createFakeConnectorsPort({ connectors: [connector] });
    port.fetchConnectorDetail = vi.fn(async () => null);
    const setConnectors = vi.fn();
    const { result, rerender } = renderHook(
      ({ retryToken }: { retryToken: string }) =>
        useConnectorDetail(port, { connectors: [connector], setConnectors, unlocked: true, retryToken }),
      { initialProps: { retryToken: 'a' } },
    );

    act(() => result.current.openDetails('slack'));
    await waitFor(() => expect(port.fetchConnectorDetail).toHaveBeenCalledTimes(1));

    rerender({ retryToken: 'a' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(port.fetchConnectorDetail).toHaveBeenCalledTimes(1);

    rerender({ retryToken: 'b' });
    await waitFor(() => expect(port.fetchConnectorDetail).toHaveBeenCalledTimes(2));
  });

  it('detailConnector resolves to null via the ?? fallback when the open id drops out of the catalog', () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector()] });
    const setConnectors = vi.fn();
    const { result, rerender } = renderHook(
      ({ conns }: { conns: Connector[] }) =>
        useConnectorDetail(port, { connectors: conns, setConnectors, unlocked: false, retryToken: 'a' }),
      { initialProps: { conns: [makeConnector()] } },
    );

    act(() => result.current.openDetails('slack'));
    expect(result.current.detailConnector?.id).toBe('slack');

    rerender({ conns: [] });
    expect(result.current.detailConnector).toBeNull();
  });

  it('loadMoreTools is a no-op when called directly while locked', async () => {
    const connector = makeConnector({ toolCount: 2, tools: [] });
    const port = createFakeConnectorsPort({ connectors: [connector] });
    const fetchDetail = vi.fn(port.fetchConnectorDetail.bind(port));
    port.fetchConnectorDetail = fetchDetail;
    const setConnectors = vi.fn();
    const { result } = renderHook(() =>
      useConnectorDetail(port, { connectors: [connector], setConnectors, unlocked: false, retryToken: 'a' }),
    );

    await act(async () => {
      await result.current.loadMoreTools('slack');
    });
    expect(fetchDetail).not.toHaveBeenCalled();
  });

  it('loadMoreTools ignores a second call for the same connector while the first is still in flight', async () => {
    const connector = makeConnector({ toolCount: 2, tools: [] });
    const port = createFakeConnectorsPort({ connectors: [connector] });
    let resolveFetch!: (v: Connector | null) => void;
    const fetchDetail = vi.fn(() => new Promise<Connector | null>((resolve) => (resolveFetch = resolve)));
    port.fetchConnectorDetail = fetchDetail;
    const setConnectors = vi.fn();
    const { result } = renderHook(() =>
      useConnectorDetail(port, { connectors: [connector], setConnectors, unlocked: true, retryToken: 'a' }),
    );

    act(() => {
      void result.current.loadMoreTools('slack');
    });
    act(() => {
      // Same connectorId while the first call's loadingIds flag is still set —
      // this dedup guard must skip issuing a second in-flight fetch.
      void result.current.loadMoreTools('slack');
    });
    expect(fetchDetail).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(null);
      await Promise.resolve();
    });
  });

  it('auto-hydrate catches a thrown fetch error and marks the connector failed with the current retryToken', async () => {
    const connector = makeConnector({ toolCount: 2, tools: [] });
    const port = createFakeConnectorsPort({ connectors: [connector] });
    port.fetchConnectorDetail = vi.fn(async () => {
      throw new Error('network down');
    });
    const setConnectors = vi.fn();
    const { result } = renderHook(() =>
      useConnectorDetail(port, { connectors: [connector], setConnectors, unlocked: true, retryToken: 'a' }),
    );

    act(() => result.current.openDetails('slack'));
    await waitFor(() => expect(port.fetchConnectorDetail).toHaveBeenCalledTimes(1));
    // toolsLoaded flips true once failedIds[id] === retryToken, proving the
    // catch block ran (not just that the promise rejected).
    await waitFor(() => expect(result.current.toolsLoaded).toBe(true));
  });

  it('loadMoreTools only updates the matching connector when multiple are present', async () => {
    const connectorA = makeConnector({ id: 'slack', toolCount: 2, tools: [] });
    const connectorB = makeConnector({
      id: 'github',
      name: 'GitHub',
      toolCount: 1,
      tools: [{ name: 'x', safety: { sideEffect: 'no_side_effect' } }],
    });
    const port = createFakeConnectorsPort({ connectors: [connectorA, connectorB] });
    const fetchDetail = vi.fn(async (id: string) =>
      id === 'slack' ? { ...connectorA, tools: [{ name: 'a', safety: { sideEffect: 'no_side_effect' } as const }] } : null,
    );
    port.fetchConnectorDetail = fetchDetail;
    let connectors = [connectorA, connectorB];
    const setConnectors = makeSetConnectorsSpy(
      () => connectors,
      (next) => {
        connectors = next;
      },
    );
    const { result } = renderHook(() =>
      useConnectorDetail(port, { connectors, setConnectors, unlocked: true, retryToken: 'a' }),
    );

    await act(async () => {
      await result.current.loadMoreTools('slack');
    });

    // The non-matching connector must come through the map's passthrough
    // branch unchanged (same reference), not be rebuilt.
    expect(connectors.find((c) => c.id === 'github')).toBe(connectorB);
    expect(connectors.find((c) => c.id === 'slack')?.tools.length).toBeGreaterThan(0);
  });

  it('a successful retry clears a previous fetch failure for that connector', async () => {
    const connector = makeConnector({ toolCount: 2, tools: [] });
    const port = createFakeConnectorsPort({ connectors: [connector] });
    let shouldFail = true;
    port.fetchConnectorDetail = vi.fn(async () => {
      if (shouldFail) throw new Error('network down');
      return { ...connector, tools: [{ name: 'a', safety: { sideEffect: 'no_side_effect' } }] };
    });
    let connectors = [connector];
    const setConnectors = makeSetConnectorsSpy(
      () => connectors,
      (next) => {
        connectors = next;
      },
    );
    const { result } = renderHook(() =>
      useConnectorDetail(port, { connectors, setConnectors, unlocked: true, retryToken: 'a' }),
    );

    act(() => result.current.openDetails('slack'));
    await waitFor(() => expect(port.fetchConnectorDetail).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.toolsLoaded).toBe(true));

    shouldFail = false;
    await act(async () => {
      await result.current.loadMoreTools('slack');
    });
    expect(connectors[0]!.tools.map((t) => t.name)).toEqual(['a']);
  });

  it('openDetails clears a previous fetch failure for that connector so it can retry immediately', async () => {
    const connector = makeConnector({ toolCount: 2, tools: [] });
    const port = createFakeConnectorsPort({ connectors: [connector] });
    port.fetchConnectorDetail = vi.fn(async () => null);
    const setConnectors = vi.fn();
    const { result } = renderHook(() =>
      useConnectorDetail(port, { connectors: [connector], setConnectors, unlocked: true, retryToken: 'a' }),
    );

    act(() => result.current.openDetails('slack'));
    await waitFor(() => expect(port.fetchConnectorDetail).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.toolsLoaded).toBe(true));

    act(() => result.current.closeDetails());
    act(() => result.current.openDetails('slack'));
    // Reopening cleared the failedIds entry (same retryToken), so the effect
    // must retry immediately instead of treating it as already-failed.
    await waitFor(() => expect(port.fetchConnectorDetail).toHaveBeenCalledTimes(2));
  });
});
