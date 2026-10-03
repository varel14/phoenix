import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { isSimulatedProvider, simulatedProvider } from "../lib/payment-providers/simulated.js";
import type { PaymentProvider } from "../lib/payment-providers/types.js";

/**
 * Registry of payment providers. Real aggregators (Mobile Money, cards, ...)
 * plug in here as additional adapters — nothing else in the codebase changes.
 */
const providers: Record<string, PaymentProvider> = {
  [simulatedProvider.name]: simulatedProvider,
};

export const paymentProviderService = {
  get(name: string | undefined | null): PaymentProvider {
    const providerName = name || env.PAYMENT_PROVIDER;
    const provider = providers[providerName];
    if (!provider) throw AppError.badRequest(`Unknown payment provider: ${providerName}`);
    if (isSimulatedProvider(provider.name) && env.isProduction) {
      throw AppError.badRequest("The simulated payment provider is not available in production");
    }
    return provider;
  },

  register(provider: PaymentProvider): void {
    providers[provider.name] = provider;
  },
};
