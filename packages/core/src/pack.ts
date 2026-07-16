import type { AnyToken, ManyToken, Token } from './token.js';

/**
 * The only resolver a pack's `services` factory ever sees. Scoped to that
 * pack's own declared `deps` — resolving a token the pack didn't declare is a
 * bug (kernel escape hatch), not a convenience, so it throws rather than
 * silently falling through to a global container.
 */
export interface PackContainer {
  get<T>(t: Token<T, string>): T;
  getMany<T>(t: ManyToken<T, string>): T[];
}

export interface Pack<
  Deps extends readonly AnyToken<unknown, string>[] = readonly AnyToken<unknown, string>[],
  Services = unknown,
  Name extends string = string,
> {
  readonly name: Name;
  readonly deps: Deps;
  readonly services: (c: PackContainer) => Services;
  readonly http?: (app: unknown, services: Services) => void;
  readonly cli?: (reg: unknown, services: Services) => void;
}

export function definePack<
  const Name extends string,
  const Deps extends readonly AnyToken<unknown, string>[],
  Services,
>(def: {
  name: Name;
  deps: Deps;
  services: (c: PackContainer) => Services;
  http?: (app: unknown, services: Services) => void;
  cli?: (reg: unknown, services: Services) => void;
}): Pack<Deps, Services, Name> {
  return def as unknown as Pack<Deps, Services, Name>;
}
