import { apiFetch } from "./api-client";

export interface UnlockResult {
  windowIndex: number;
  /** ISO instant — the device locks itself again once the clock passes it. */
  endsAt: string;
}

export const appLockApi = {
  /** Checks a code typed on the lock screen against the current 3-day window. */
  async verify(code: string): Promise<UnlockResult> {
    const result = await apiFetch<{ data: UnlockResult }>(
      "/api/v1/app-lock/verify",
      // A wrong code answers 401 on purpose — it must not sign the user out.
      { method: "POST", body: { code }, ignoreUnauthorized: true },
    );
    return result.data;
  },
};
