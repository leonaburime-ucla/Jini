/**
 * @module fastify/route-registration-guard
 *
 * Builds a queryable inventory of every route registered on a Fastify instance, and guards a
 * caller-supplied set of "must register at most once" route keys against accidental duplicate
 * registration — e.g. two packs each mounting `POST /api/runs` would otherwise silently shadow
 * one another instead of failing loudly at composition time.
 *
 * Unlike the Express version (`../express/route-registration-guard.ts`, which monkey-patches
 * `get`/`post`/etc. because Express has no first-class "a route was just registered" signal),
 * Fastify exposes a built-in `onRoute` application hook that fires exactly once per registered
 * route with the fully resolved `{ method, url }` — no monkey-patching needed. `guardedRouteKey`
 * is deliberately duplicated (not imported) from the Express version; see
 * `./response.ts`'s top-of-module doc for why this subtree does not import from `express/`.
 */
import type { FastifyInstance } from 'fastify';

/** One recorded route registration: the HTTP verb and the literal string path it was mounted on. */
export interface RouteRegistration {
  method: string;
  path: string;
}

const routeInventorySymbol = Symbol.for('jini.routeRegistrationGuard.inventory');

/**
 * Builds the `METHOD PATH` key used to check `guardedRouteKeys` membership.
 *
 * @param method - The HTTP method name (any case; normalized to upper-case in the key).
 * @param path - The route's registered URL. Fastify's `onRoute` hook always supplies a string
 * `url`, so (unlike the Express version) there is no non-string-path branch to guard against here.
 * @param guardedRouteKeys - The set of `METHOD PATH` keys this call installed a duplicate-registration
 * guard for.
 * @returns The matching key if it is in `guardedRouteKeys`, otherwise `null`.
 * @complexity O(1) — a single `Set` lookup.
 * @overallScore 100/100
 */
export function guardedRouteKey(method: string, path: string, guardedRouteKeys: ReadonlySet<string>): string | null {
  const key = `${method.toUpperCase()} ${path}`;
  return guardedRouteKeys.has(key) ? key : null;
}

export interface InstallRouteRegistrationGuardOptions {
  /** `METHOD PATH` keys (e.g. `'POST /api/runs'`) that must be registered at most once on `app`. Defaults to none — installing the guard with no options only builds the inventory, it enforces nothing. */
  guardedRouteKeys?: ReadonlySet<string>;
}

/**
 * Registers a Fastify `onRoute` application hook that records every route registration into a
 * per-app inventory (retrievable via {@link getRouteRegistrationInventory}) and throws if any
 * `options.guardedRouteKeys` entry is registered a second time.
 *
 * A route registered for multiple HTTP methods at once (`method: ['GET', 'POST']`, or Fastify's
 * own automatic `HEAD` sibling for a `GET` route when `exposeHeadRoute` is left at its default)
 * produces one inventory entry and one guard check per method — mirroring how the Express version
 * records one entry per distinct `app.get(...)`/`app.post(...)` call.
 *
 * @param app - The Fastify instance to instrument. Must not already have this guard installed
 * (installing twice would double-register the `onRoute` hook and double-count the inventory — not
 * guarded against here since every caller in this codebase calls this exactly once per app at
 * composition time).
 * @param options.guardedRouteKeys - See {@link InstallRouteRegistrationGuardOptions}.
 * @returns Nothing — registers a hook on `app` and stashes its inventory under a well-known `Symbol.for` key.
 * @throws If a `guardedRouteKeys` entry is registered more than once, at the moment of the second registration.
 * @complexity O(1) setup; each `onRoute` firing is O(m) in the number of methods the route was registered for (typically 1).
 * @overallScore 100/100
 */
export function installRouteRegistrationGuard(
  app: FastifyInstance,
  options: InstallRouteRegistrationGuardOptions = {},
): void {
  const guardedRouteKeys = options.guardedRouteKeys ?? new Set<string>();
  const seen = new Set<string>();
  const inventory: RouteRegistration[] = [];
  (app as unknown as Record<symbol, RouteRegistration[]>)[routeInventorySymbol] = inventory;

  app.addHook('onRoute', (routeOptions) => {
    const methods = Array.isArray(routeOptions.method) ? routeOptions.method : [routeOptions.method];
    for (const method of methods) {
      inventory.push({ method: method.toUpperCase(), path: routeOptions.url });
      const key = guardedRouteKey(method, routeOptions.url, guardedRouteKeys);
      if (key) {
        if (seen.has(key)) {
          throw new Error(`duplicate guarded route registration: ${key}`);
        }
        seen.add(key);
      }
    }
  });
}

/**
 * Reads back every route {@link installRouteRegistrationGuard} recorded for `app`.
 *
 * @param app - An app the guard was installed on. Safe to call on an app with no guard installed
 * (returns an empty array rather than throwing).
 * @returns A fresh array copy each call — the caller can never mutate the guard's own internal inventory through the returned reference.
 * @complexity O(n) in the number of routes registered so far.
 * @overallScore 100/100
 */
export function getRouteRegistrationInventory(app: FastifyInstance): RouteRegistration[] {
  return [...((app as unknown as Record<symbol, RouteRegistration[] | undefined>)[routeInventorySymbol] ?? [])];
}
