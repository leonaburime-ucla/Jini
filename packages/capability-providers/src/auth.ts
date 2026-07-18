/**
 * `AuthProvider` — a swappable identity/session port. Speculative
 * port-design exploration (see `source-map.md`): Zana and Tovu-Runner each
 * independently built an explicit capability-provider layer with auth as one
 * of the swappable capabilities (Supabase/sqlite-backed) — this is the
 * engine-level shape that convergence points at, not a lift from either.
 *
 * `createInMemoryAuthProvider` is a minimal reference stub proving the port
 * is genuinely implementable — plaintext password storage and a
 * non-cryptographic token, deliberately not a security reference. A real
 * adapter (Supabase Auth, Auth0, a JWT-backed service) implements the same
 * interface.
 */

export interface AuthCredentials {
  readonly email: string;
  readonly password: string;
}

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly createdAt: number;
}

export interface AuthSession {
  readonly token: string;
  readonly userId: string;
  readonly expiresAt: number;
}

export interface AuthProvider {
  /** Creates a new user. Rejects if `credentials.email` is already registered. */
  signUp(credentials: AuthCredentials): Promise<AuthUser>;
  /** Exchanges valid credentials for a new session. Rejects on an unknown email or wrong password. */
  signIn(credentials: AuthCredentials): Promise<AuthSession>;
  /** Invalidates a session token. A no-op on an already-invalid/unknown token. */
  signOut(token: string): Promise<void>;
  /** Resolves a session token to its user, or `null` if the token is unknown, invalidated, or expired. */
  verifySession(token: string): Promise<AuthUser | null>;
}

export interface InMemoryAuthProviderOptions {
  /** Session lifetime in ms. Defaults to 1 hour. */
  readonly sessionTtlMs?: number;
  /** Injectable clock for deterministic tests; defaults to `Date.now`. */
  readonly now?: () => number;
}

const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;

interface StoredUser extends AuthUser {
  readonly password: string;
}

/** Creates the in-memory reference `AuthProvider`. No persistence — state is lost on process exit. */
export function createInMemoryAuthProvider(options: InMemoryAuthProviderOptions = {}): AuthProvider {
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const now = options.now ?? Date.now;
  const usersByEmail = new Map<string, StoredUser>();
  const sessions = new Map<string, AuthSession>();
  let nextId = 1;
  let nextToken = 1;

  return {
    async signUp(credentials: AuthCredentials): Promise<AuthUser> {
      if (usersByEmail.has(credentials.email)) {
        throw new Error(`email already registered: ${credentials.email}`);
      }
      const user: StoredUser = {
        id: `user-${nextId++}`,
        email: credentials.email,
        password: credentials.password,
        createdAt: now(),
      };
      usersByEmail.set(credentials.email, user);
      return { id: user.id, email: user.email, createdAt: user.createdAt };
    },

    async signIn(credentials: AuthCredentials): Promise<AuthSession> {
      const user = usersByEmail.get(credentials.email);
      if (!user || user.password !== credentials.password) {
        throw new Error('invalid email or password');
      }
      const session: AuthSession = {
        token: `session-${nextToken++}`,
        userId: user.id,
        expiresAt: now() + sessionTtlMs,
      };
      sessions.set(session.token, session);
      return session;
    },

    async signOut(token: string): Promise<void> {
      sessions.delete(token);
    },

    async verifySession(token: string): Promise<AuthUser | null> {
      const session = sessions.get(token);
      if (!session) return null;
      if (session.expiresAt <= now()) {
        sessions.delete(token);
        return null;
      }
      // This port surface has no deleteUser, so a session's userId always
      // resolves — the non-null assertion documents that invariant rather
      // than a defensive branch with no real runtime path.
      const user = [...usersByEmail.values()].find((u) => u.id === session.userId)!;
      return { id: user.id, email: user.email, createdAt: user.createdAt };
    },
  };
}
