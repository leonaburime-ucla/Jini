/**
 * `RealtimeProvider` — a swappable pub/sub port (live updates pushed to
 * subscribers). Speculative port-design exploration (see `source-map.md`) —
 * no OD source; named in `docs/jini-port/recon/r5b-consumers-matrix.md` §3.3
 * as part of the Zana/Tovu-convergent capability set (Supabase Realtime is
 * Zana's reference adapter).
 *
 * `createInMemoryRealtimeProvider` is a minimal reference stub proving the
 * port is implementable — synchronous in-process fan-out, no cross-process
 * delivery. A real adapter (Supabase Realtime, a WebSocket/Redis pub-sub
 * service) implements the same interface.
 */

export type RealtimeHandler<T = unknown> = (event: T) => void;

/** Call to stop receiving events for the subscription that returned it. Idempotent. */
export type RealtimeUnsubscribe = () => void;

export interface RealtimeProvider {
  /** Delivers `event` synchronously to every current subscriber of `channel`. Resolves once all handlers have run. */
  publish<T>(channel: string, event: T): Promise<void>;
  /** Registers `handler` for every future `publish` on `channel`. Returns an unsubscribe function. */
  subscribe<T>(channel: string, handler: RealtimeHandler<T>): RealtimeUnsubscribe;
}

/** Creates the in-memory reference `RealtimeProvider`. Delivery is in-process only — no cross-process fan-out. */
export function createInMemoryRealtimeProvider(): RealtimeProvider {
  const channels = new Map<string, Set<RealtimeHandler>>();

  function subscribersFor(channel: string): Set<RealtimeHandler> {
    let subscribers = channels.get(channel);
    if (!subscribers) {
      subscribers = new Set();
      channels.set(channel, subscribers);
    }
    return subscribers;
  }

  return {
    async publish<T>(channel: string, event: T): Promise<void> {
      const subscribers = channels.get(channel);
      if (!subscribers) return;
      for (const handler of [...subscribers]) {
        handler(event);
      }
    },

    subscribe<T>(channel: string, handler: RealtimeHandler<T>): RealtimeUnsubscribe {
      const subscribers = subscribersFor(channel);
      subscribers.add(handler as RealtimeHandler);
      let unsubscribed = false;
      return () => {
        if (unsubscribed) return;
        unsubscribed = true;
        subscribers.delete(handler as RealtimeHandler);
      };
    },
  };
}
