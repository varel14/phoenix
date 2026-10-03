import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { paymentsApi } from "@/services/api/payments-api";
import { queryKeys } from "@/constants/query-keys";
import type { PaymentTransactionStatus } from "@/types/payments";

export function usePaymentCategories() {
  return useQuery({ queryKey: queryKeys.paymentCategories(), queryFn: () => paymentsApi.categories() });
}

export function usePaymentServices(categoryId?: string) {
  return useQuery({
    queryKey: queryKeys.paymentServices(categoryId),
    queryFn: () => paymentsApi.services(categoryId ? { categoryId } : {}),
  });
}

export function usePaymentService(id: string) {
  return useQuery({ queryKey: queryKeys.paymentService(id), queryFn: () => paymentsApi.service(id) });
}

export function useInitiatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { serviceId: string; amount?: number; fields: Record<string, string> }) =>
      paymentsApi.initiate(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useDevConfirmPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reference: string) => paymentsApi.devConfirm(reference),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useTransactions(status?: PaymentTransactionStatus) {
  return useQuery({
    queryKey: queryKeys.transactions(status),
    queryFn: () => paymentsApi.list({ limit: 50, ...(status ? { status } : {}) }),
  });
}

export function useTransaction(id: string) {
  return useQuery({ queryKey: queryKeys.transaction(id), queryFn: () => paymentsApi.getById(id) });
}
