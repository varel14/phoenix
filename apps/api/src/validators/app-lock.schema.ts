import { z } from "zod";
import { APP_LOCK_CODE_LENGTH } from "../services/app-lock.service.js";

/** Body of POST /app-lock/verify — the code typed on the lock screen. */
export const verifyUnlockCodeBodySchema = z.object({
  code: z
    .string()
    .min(1, "Code requis")
    .max(APP_LOCK_CODE_LENGTH * 2, "Le code doit contenir 6 caractères"),
});

export type VerifyUnlockCodeBody = z.infer<typeof verifyUnlockCodeBodySchema>;
