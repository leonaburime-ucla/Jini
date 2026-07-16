export interface Token<T, Id extends string = string> {
  readonly id: Id;
  readonly version: number;
  readonly cardinality: 'one';
  /** Phantom — never assigned; carries T for inference only. */
  readonly __type?: T;
}

export interface ManyToken<T, Id extends string = string> {
  readonly id: Id;
  readonly version: number;
  readonly cardinality: 'many';
  /** Phantom — never assigned; carries T for inference only. */
  readonly __type?: T;
}

export type AnyToken<T = unknown, Id extends string = string> = Token<T, Id> | ManyToken<T, Id>;

export function token<T, const Id extends string = string>(id: Id, opts: { version?: number } = {}): Token<T, Id> {
  return { id, version: opts.version ?? 1, cardinality: 'one' };
}

export function manyToken<T, const Id extends string = string>(
  id: Id,
  opts: { version?: number } = {},
): ManyToken<T, Id> {
  return { id, version: opts.version ?? 1, cardinality: 'many' };
}
