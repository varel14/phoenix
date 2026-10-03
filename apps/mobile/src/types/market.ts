/** Boutique / Marketplace API shapes. */

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
}

export interface ProductSeller {
  id: string;
  name: string;
  isVerified: boolean;
}

export interface ProductImage {
  id: string;
  url: string;
  position: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
  priceOverride: number | null;
  stock: number | null;
}

export interface ProductCard {
  id: string;
  name: string;
  description: string | null;
  type: "PHYSICAL" | "DIGITAL";
  price: number;
  currency: string;
  stock: number | null;
  category: ProductCategory;
  seller: ProductSeller;
  images: ProductImage[];
}

export interface ProductDetail extends ProductCard {
  sku: string | null;
  weightGrams: number | null;
  downloadLimit: number | null;
  variants: ProductVariant[];
}

export interface CartItem {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  product: ProductCard & { images: ProductImage[] };
  variant: ProductVariant | null;
}

export interface Cart {
  id: string;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  currency: string;
  requiresShipping: boolean;
}

export type OrderStatus =
  | "PENDING"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  productType: "PHYSICAL" | "DIGITAL";
  downloadLimit: number | null;
  downloadCount: number;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderAddress {
  recipientName: string;
  phone: string;
  city: string;
  area: string | null;
  addressLine: string | null;
  instructions: string | null;
}

export interface OrderTransactionRef {
  id: string;
  reference: string;
  status: string;
  amount: number;
  provider: string;
}

export interface Order {
  id: string;
  reference: string;
  status: OrderStatus;
  subtotal: number;
  shippingFee: number;
  total: number;
  currency: string;
  paidAt: string | null;
  createdAt: string;
  items: OrderItem[];
  address: OrderAddress | null;
  transactions: OrderTransactionRef[];
}

export interface ShippingAddressInput {
  recipientName: string;
  phone: string;
  city: string;
  area?: string;
  addressLine?: string;
  instructions?: string;
}

/** French labels for order statuses (mobile UI). */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "En attente",
  AWAITING_PAYMENT: "En attente de paiement",
  PAID: "Payée",
  PROCESSING: "En préparation",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};
