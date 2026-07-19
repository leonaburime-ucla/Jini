import { describe, expect, it } from 'vitest';
import { bindings, createDaemon, definePack, token } from '@jini/core';
import { mountPackHttp } from '../pack-http.js';

interface Greeter {
  greeting: string;
}

const GreeterToken = token<Greeter>('test.greeter');

describe('mountPackHttp', () => {
  it('calls a pack\'s http registrar with the mounted app and its own composed services', () => {
    const calls: Array<{ app: unknown; services: unknown }> = [];
    const greetPack = definePack({
      name: 'greet',
      deps: [GreeterToken],
      services: (c) => ({ say: () => c.get(GreeterToken).greeting }),
      http: (app: unknown, services: unknown) => calls.push({ app, services }),
    });

    const daemon = createDaemon({
      packs: [greetPack],
      bindings: bindings().bind(GreeterToken, { greeting: 'hi' }),
    });

    const fakeApp = { get: () => {} };
    mountPackHttp(fakeApp as any, [greetPack], daemon);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.app).toBe(fakeApp);
    expect((calls[0]!.services as { say: () => string }).say()).toBe('hi');
  });

  it('skips packs with no http registrar', () => {
    const cliOnlyPack = definePack({
      name: 'cliOnly',
      deps: [],
      services: () => ({}),
    });

    const daemon = createDaemon({ packs: [cliOnlyPack], bindings: bindings() });

    expect(() => mountPackHttp({} as any, [cliOnlyPack], daemon)).not.toThrow();
  });

  it('mounts multiple packs in order, each with its own services', () => {
    const order: string[] = [];
    const packA = definePack({
      name: 'a',
      deps: [],
      services: () => ({ id: 'a' }),
      http: (_app: unknown, services: any) => order.push(services.id),
    });
    const packB = definePack({
      name: 'b',
      deps: [],
      services: () => ({ id: 'b' }),
      http: (_app: unknown, services: any) => order.push(services.id),
    });

    const daemon = createDaemon({ packs: [packA, packB], bindings: bindings() });
    mountPackHttp({} as any, [packA, packB], daemon);

    expect(order).toEqual(['a', 'b']);
  });
});
