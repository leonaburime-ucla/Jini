/**
 * `PaymentsProvider` — a swappable payment-charge port. Speculative
 * port-design exploration (see `source-map.md`) — no OD source; named
 * explicitly in `docs/jini-port/recon/r5b-consumers-matrix.md` §3.3 as one
 * of the capabilities Zana/Tovu's independent provider layers converge on
 * (alongside auth/storage/db/realtime).
 *
 * `createInMemoryPaymentsProvider` is a minimal reference stub proving the
 * port is implementable — every charge deterministically succeeds, no real
 * money moves. A real adapter (Stripe, a payment processor) implements the
 * same interface.
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

/** Creates the in-memory reference `PaymentsProvider`. No persistence, no real money movement. */
export function createInMemoryPaymentsProvider(): PaymentsProvider {
  const charges = new Map<string, Charge>();
  let nextChargeId = 1;

  return {
    async charge(input: ChargeInput): Promise<Charge> {
      if (input.amountCents <= 0) {
        throw new Error('amountCents must be positive');
      }
      const record: Charge = {
        id: `charge-${nextChargeId++}`,
        status: 'succeeded',
        amountCents: input.amountCents,
        currency: input.currency,
        customerRef: input.customerRef,
        createdAt: Date.now(),
      };
      charges.set(record.id, record);
      return record;
    },

    async getCharge(id: string): Promise<Charge | null> {
      return charges.get(id) ?? null;
    },

    async refund(id: string): Promise<Charge> {
      const existing = charges.get(id);
      if (!existing) {
        throw new Error(`unknown charge: ${id}`);
      }
      if (existing.status !== 'succeeded') {
        throw new Error(`charge ${id} is not refundable from status "${existing.status}"`);
      }
      const refunded: Charge = { ...existing, status: 'refunded' };
      charges.set(id, refunded);
      return refunded;
    },
  };
}
