import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cartApi, ordersApi, productCategoriesApi, productsApi, type ProductListParams } from "@/services/api/market-api";
import { queryKeys } from "@/constants/query-keys";
import type { ShippingAddressInput } from "@/types/market";

export function useProducts(params: ProductListParams) {
  return useQuery({
    queryKey: queryKeys.products(params),
    queryFn: () => productsApi.list(params),
  });
}

export function useProduct(id: string) {
  return useQuery({ queryKey: queryKeys.product(id), queryFn: () => productsApi.getById(id) });
}

export function useProductCategories() {
  return useQuery({ queryKey: queryKeys.productCategories(), queryFn: () => productCategoriesApi.list() });
}

export function useCart() {
  return useQuery({ queryKey: queryKeys.cart(), queryFn: () => cartApi.get() });
}

export function useCartMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["cart"] });

  const addItem = useMutation({
    mutationFn: ({ productId, quantity, variantId }: { productId: string; quantity: number; variantId?: string }) =>
      cartApi.addItem(productId, quantity, variantId),
    onSuccess: invalidate,
  });
  const updateItem = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => cartApi.updateItem(itemId, quantity),
    onSuccess: invalidate,
  });
  const removeItem = useMutation({
    mutationFn: (itemId: string) => cartApi.removeItem(itemId),
    onSuccess: invalidate,
  });
  const clear = useMutation({
    mutationFn: () => cartApi.clear(),
    onSuccess: invalidate,
  });

  return { addItem, updateItem, removeItem, clear };
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shippingAddress?: ShippingAddressInput) => ordersApi.create(shippingAddress),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useOrders() {
  return useQuery({ queryKey: queryKeys.orders(), queryFn: () => ordersApi.list({ limit: 50 }) });
}

export function useOrder(id: string, options: { enabled?: boolean; refetchInterval?: number | false } = {}) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => ordersApi.getById(id),
    enabled: options.enabled ?? id.length > 0,
    refetchInterval: options.refetchInterval,
  });
}
