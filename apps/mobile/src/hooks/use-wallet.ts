import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { walletApi } from "@/services/api/wallet-api";
import { queryKeys } from "@/constants/query-keys";
import type {
  MobileMoneyProvider,
  WalletTransactionType,
} from "@/types/wallet";

/** Invalidates everything a balance or ledger change touches. */
function useInvalidateWallet() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    void queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
  };
}

export function useWallet() {
  return useQuery({
    queryKey: queryKeys.wallet(),
    queryFn: () => walletApi.show(),
  });
}

export function useWalletTransactions(type?: WalletTransactionType) {
  return useQuery({
    queryKey: queryKeys.walletTransactions(type),
    queryFn: () =>
      walletApi.transactions({ limit: 50, ...(type ? { type } : {}) }),
  });
}

export function useWalletTransaction(id: string) {
  return useQuery({
    queryKey: queryKeys.walletTransaction(id),
    queryFn: () => walletApi.detail(id),
    enabled: Boolean(id),
  });
}

export function useWalletRecipients(search: string) {
  return useQuery({
    queryKey: queryKeys.walletRecipients(search),
    queryFn: () => walletApi.recipients(search ? { search } : {}),
  });
}

export function useInitiateTopup() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: (body: { amount: number; note?: string }) =>
      walletApi.initiateTopup(body),
    onSettled: invalidate,
  });
}

export function useDevConfirmTopup() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: (reference: string) => walletApi.devConfirmTopup(reference),
    onSettled: invalidate,
  });
}

export function useInitiatePhoneTransfer() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: (body: {
      phoneNumber: string;
      provider: MobileMoneyProvider;
      amount: number;
      note?: string;
    }) => walletApi.initiatePhoneTransfer(body),
    onSettled: invalidate,
  });
}

export function useDevConfirmPhoneTransfer() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: (reference: string) =>
      walletApi.devConfirmPhoneTransfer(reference),
    onSettled: invalidate,
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: queryKeys.paymentMethods(),
    queryFn: () => walletApi.listPaymentMethods(),
  });
}

export function usePaymentMethodMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
  };

  const addMethod = useMutation({
    mutationFn: (body: {
      provider: MobileMoneyProvider;
      phoneNumber: string;
      isDefault?: boolean;
    }) => walletApi.createPaymentMethod(body),
    onSuccess: invalidate,
  });
  const removeMethod = useMutation({
    mutationFn: (id: string) => walletApi.deletePaymentMethod(id),
    onSuccess: invalidate,
  });
  const setDefaultMethod = useMutation({
    mutationFn: (id: string) => walletApi.setDefaultPaymentMethod(id),
    onSuccess: invalidate,
  });

  return { addMethod, removeMethod, setDefaultMethod };
}

export function useTransfer() {
  const invalidate = useInvalidateWallet();
  return useMutation({
    mutationFn: (body: {
      recipientId: string;
      amount: number;
      note?: string;
    }) => walletApi.transfer(body),
    onSettled: invalidate,
  });
}
