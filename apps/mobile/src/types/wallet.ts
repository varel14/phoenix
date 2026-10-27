/** Chuyassi Emmanuel Pay wallet — balance, top-ups and P2P transfers. */

export type WalletTransactionType =
  | "TOPUP"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "PHONE_TRANSFER";

/** Real-world mobile money operators the wallet can wire money to. */
export type MobileMoneyProvider = "ORANGE_MONEY" | "MTN_MONEY";

export const MOBILE_MONEY_LABELS: Record<MobileMoneyProvider, string> = {
  ORANGE_MONEY: "Orange Money",
  MTN_MONEY: "MTN Money",
};

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
  /** Present on detail endpoints — whether the signed-in user follows them. */
  isFollowing?: boolean;
  /** Both users follow each other — the wallet's payment inner circle. */
  isMutual?: boolean;
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
  /** Phone transfers: the destination number (digits only). */
  phoneNumber?: string | null;
  /** Phone transfers: the mobile money operator. */
  provider?: MobileMoneyProvider | null;
  createdAt: string;
}

/** A person the user can send money to (follow, contact, or search match). */
export interface WalletRecipient extends WalletUserRef {
  isFollowing?: boolean;
  isMutual?: boolean;
}

/** French labels for wallet transaction types (mobile UI). */
export const WALLET_TYPE_LABELS: Record<WalletTransactionType, string> = {
  TOPUP: "Rechargement",
  TRANSFER_IN: "Reçu",
  TRANSFER_OUT: "Envoyé",
  PHONE_TRANSFER: "Transfert mobile",
};
