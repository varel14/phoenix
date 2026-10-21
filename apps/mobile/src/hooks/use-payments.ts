import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentsApi } from "@/services/api/payments-api";

export function useInitiatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      serviceId: string;
      amount?: number;
      fields: Record<string, string>;
    }) => paymentsApi.initiate(body),
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
