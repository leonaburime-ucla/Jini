/**
 * `PaymentsProvider` — a swappable payment-charge port. Speculative
 * port-design exploration (see `source-map.md`) — no OD source; named
 * explicitly in `docs/jini-port/recon/r5b-consumers-matrix.md` §3.3 as one
 * of the capabilities Zana/Tovu's independent provider layers converge on
 * (alongside auth/storage/db/realtime).
 *
 * This file defines only the port's stable interface/type surface — safe to
 * import from the normal `@jini/capability-providers` entry point. The
 * in-memory reference implementation (`createInMemoryPaymentsProvider`) is a
 * non-production stub and lives under `src/unsafe-reference/`, exported only
 * from the separate `@jini/capability-providers/unsafe-reference` entry
 * point — see that directory's `index.ts` header for the full warning.
 */

export type ChargeStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface ChargeInput {
  readonly amountCents: number;
  readonly currency: string;
  readonly customerRef: string;
  readonly description?: string;
}

export interface Charge {
  readonly id: string;
  readonly status: ChargeStatus;
  readonly amountCents: number;
  readonly currency: string;
  readonly customerRef: string;
  readonly createdAt: number;
}

export interface PaymentsProvider {
  /** Creates and (in the reference stub) immediately settles a charge. Rejects on a non-positive amount. */
  charge(input: ChargeInput): Promise<Charge>;
  /** Looks up a previously created charge by id, or `null` if unknown. */
  getCharge(id: string): Promise<Charge | null>;
  /** Refunds a `'succeeded'` charge. Rejects if the charge is unknown or not in a refundable state. */
  refund(id: string): Promise<Charge>;
}
