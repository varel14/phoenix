import type { PaymentInitiationInput, PaymentInitiationResult, PaymentProvider } from "./types.js";

/**
 * Development-only provider. It never confirms a payment by itself: success is
 * only ever recorded through the signed webhook pipeline (or the dev-confirm
 * endpoint, which itself goes through that pipeline). Blocked in production.
 */
export const simulatedProvider: PaymentProvider = {
  name: "simulated",
  async initiate(_input: PaymentInitiationInput): Promise<PaymentInitiationResult> {
    return {
      instructions: "Validation en attente — la confirmation sera effectuée par le serveur.",
    };
  },
};

/** Factory guard so the simulated provider can never ship to production. */
export function isSimulatedProvider(name: string): boolean {
  return name === simulatedProvider.name;
}
