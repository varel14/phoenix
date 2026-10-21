import { Router } from "express";
import { walletController } from "../controllers/wallet.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import {
  initiateTopupBodySchema,
  listWalletTransactionsQuerySchema,
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
walletRouter.post(
  "/transfers",
  validate({ body: transferBodySchema }),
  walletController.transfer,
);
