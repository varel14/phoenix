/** Chuyassi Emmanuel Pay / Exchange API shapes. */

export type PaymentTransactionStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export interface PaymentCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}

export type PaymentFieldType = "TEXT" | "NUMBER" | "PHONE" | "EMAIL" | "SELECT";

export interface PaymentServiceField {
  id: string;
  serviceId: string;
  key: string;
  label: string;
  type: PaymentFieldType;
  required: boolean;
  placeholder: string | null;
  options: string[] | null;
  sortOrder: number;
}

export interface PaymentCategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface PaymentService {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  pricingMode: "FIXED" | "FREE";
  fixedPrice: number | null;
  minPrice: number | null;
  currency: string;
  category: PaymentCategoryRef;
}

export interface PaymentServiceDetail extends PaymentService {
  fields: PaymentServiceField[];
}

export interface PaymentReceipt {
  id: string;
  transactionId: string;
  reference: string;
  externalReference: string | null;
  amount: number;
  currency: string;
  method: string | null;
  issuedAt: string;
}

export interface PaymentOrderRef {
  id: string;
  reference: string;
  status: string;
}

export interface PaymentTransaction {
  id: string;
  reference: string;
  provider: string;
  providerReference: string | null;
  amount: number;
  currency: string;
  status: PaymentTransactionStatus;
  metadata: { fields?: Record<string, string>; instructions?: string | null } | null;
  paidAt: string | null;
  createdAt: string;
  service: (PaymentService & { category: PaymentCategoryRef }) | null;
  receipt: PaymentReceipt | null;
  order: PaymentOrderRef | null;
}

export interface InitiatePaymentResult {
  transaction: PaymentTransaction;
  paymentUrl: string | null;
  instructions: string | null;
}

/** French labels for transaction statuses (mobile UI). */
export const TRANSACTION_STATUS_LABELS: Record<PaymentTransactionStatus, string> = {
  PENDING: "En attente",
  PROCESSING: "En cours",
  SUCCESS: "Réussi",
  FAILED: "Échoué",
  CANCELLED: "Annulé",
  REFUNDED: "Remboursé",
};
