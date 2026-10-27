import { Router } from "express";
import { walletController } from "../controllers/wallet.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import {
  createPaymentMethodBodySchema,
  initiateTopupBodySchema,
  listWalletTransactionsQuerySchema,
  phoneTransferBodySchema,
  referenceParamsSchema,
  transferBodySchema,
  walletRecipientsQuerySchema,
} from "../validators/wallet.schema.js";

/**
 * Mounted under /wallet: the signed-in user's wallet — balance, top-ups,
 * peer-to-peer transfers and the transaction ledger.
 */
export const walletRouter = Router();

walletRouter.use(requireAuth);

walletRouter.get("/", walletController.show);
walletRouter.get(
  "/transactions",
  validate({ query: listWalletTransactionsQuerySchema }),
  walletController.transactions,
);
walletRouter.get(
  "/transactions/:id",
  validate({ params: idParamsSchema }),
  walletController.detail,
);
walletRouter.get(
  "/recipients",
  validate({ query: walletRecipientsQuerySchema }),
  walletController.recipients,
);

walletRouter.post(
  "/topups",
  validate({ body: initiateTopupBodySchema }),
  walletController.initiateTopup,
);
walletRouter.post(
  "/topups/:reference/dev-confirm",
  validate({ params: referenceParamsSchema }),
  walletController.devConfirmTopup,
);

// Real-world mobile money: wire money to an Orange Money / MTN number.
walletRouter.post(
  "/phone-transfers",
  validate({ body: phoneTransferBodySchema }),
  walletController.initiatePhoneTransfer,
);
walletRouter.post(
  "/phone-transfers/:reference/dev-confirm",
  validate({ params: referenceParamsSchema }),
  walletController.devConfirmPhoneTransfer,
);

// Payment methods: the user's own mobile money numbers (wallet addresses).
walletRouter.get("/methods", walletController.listPaymentMethods);
walletRouter.post(
  "/methods",
  validate({ body: createPaymentMethodBodySchema }),
  walletController.createPaymentMethod,
);
walletRouter.delete(
  "/methods/:id",
  validate({ params: idParamsSchema }),
  walletController.deletePaymentMethod,
);
walletRouter.patch(
  "/methods/:id/default",
  validate({ params: idParamsSchema }),
  walletController.setDefaultPaymentMethod,
);
walletRouter.post(
  "/transfers",
  validate({ body: transferBodySchema }),
  walletController.transfer,
);
