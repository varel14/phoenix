/** Chuyassi Emmanuel Pay wallet — balance, top-ups and P2P transfers. */

export type WalletTransactionType = "TOPUP" | "TRANSFER_IN" | "TRANSFER_OUT";

export type WalletTransactionStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface Wallet {
  id: string;
  balance: number;
  currency: string;
}

export interface WalletUserRef {
  id: string;
  name: string;
  image: string | null;
}

export interface WalletTransaction {
  id: string;
  type: WalletTransactionType;
  status: WalletTransactionStatus;
  amount: number;
  balanceAfter: number | null;
  currency: string;
  reference: string;
  transferRef: string | null;
  note: string | null;
  counterparty: WalletUserRef | null;
  createdAt: string;
}

/** A person the user can send money to (contact, recent counterparty, or search match). */
export type WalletRecipient = WalletUserRef;

/** French labels for wallet transaction types (mobile UI). */
export const WALLET_TYPE_LABELS: Record<WalletTransactionType, string> = {
  TOPUP: "Rechargement",
  TRANSFER_IN: "Reçu",
  TRANSFER_OUT: "Envoyé",
};
