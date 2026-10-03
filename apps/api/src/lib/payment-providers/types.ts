/**
 * Payment provider abstraction.
 *
 * Phoenix business logic only ever talks to this interface — provider-specific
 * logic (Mobile Money, card processors, partners) lives in dedicated adapters.
 */

export interface PaymentInitiationInput {
  reference: string;
  amount: number;
  currency: string;
  description?: string | undefined;
  customerEmail?: string | undefined;
}

export interface PaymentInitiationResult {
  /** Provider-hosted checkout URL when the provider supports redirects. */
  paymentUrl?: string | null;
  /** Free-form instructions surfaced to the user (in French on the client). */
  instructions?: string | null;
  /** Provider-generated reference, when the provider assigns one upfront. */
  providerReference?: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  initiate(input: PaymentInitiationInput): Promise<PaymentInitiationResult>;
}
