import { act, renderHook, waitFor } from '@testing-library/react';
import type { Dispatch, SetStateAction } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useConnectorDetail } from '../../hooks/useConnectorDetail.js';
import { createFakeConnectorsPort } from '../../dependencies.js';
import type { Connector } from '../../types.js';

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
});
