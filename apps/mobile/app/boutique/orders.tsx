import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useOrders } from "@/hooks/use-market";
import { AppText, EmptyView, ErrorView, IconButton, LoadingView } from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatMoney } from "@/utils/money";
import { API_URL } from "@/services/api/api-client";
import { ORDER_STATUS_LABELS, type Order, type OrderItem } from "@/types/market";

const DOWNLOADABLE_STATUSES = new Set(["PAID", "PROCESSING", "SHIPPED", "DELIVERED"]);

export default function OrdersScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const query = useOrders();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Retour" />
        <AppText variant="heading" style={{ flex: 1, textAlign: "center", marginRight: 40 }}>
          Mes commandes
        </AppText>
      </View>

      {query.isLoading ? (
        <LoadingView label="Chargement des commandes…" />
      ) : query.isError ? (
        <ErrorView message={(query.error as Error)?.message} onRetry={() => void query.refetch()} />
      ) : !query.data || query.data.data.length === 0 ? (
        <EmptyView title="Aucune commande" subtitle="Vos commandes Boutique apparaîtront ici." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}>
          {query.data.data.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function OrderCard({ order }: { order: Order }) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const downloadable = DOWNLOADABLE_STATUSES.has(order.status);

  const statusColor =
    order.status === "PAID" || order.status === "DELIVERED"
      ? colors.success
      : order.status === "CANCELLED" || order.status === "REFUNDED"
        ? colors.danger
        : order.status === "AWAITING_PAYMENT" || order.status === "PENDING"
          ? colors.warning
          : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => setExpanded(!expanded)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceHighlight : colors.surface,
        borderRadius: radii.lg,
        padding: spacing.lg,
        gap: spacing.sm,
      })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ gap: 2 }}>
          <AppText variant="subheading">Commande {order.reference}</AppText>
          <AppText variant="small" color={colors.textFaint}>
            {new Date(order.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
          </AppText>
        </View>
        <AppText variant="subheading" color={colors.accent}>
          {formatMoney(order.total, order.currency)}
        </AppText>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md }}>
        <AppText variant="bodyMuted" numberOfLines={1} style={{ flex: 1 }}>
          {order.items.map((item) => `${item.quantity} × ${item.productName}`).join(", ")}
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: radii.full, backgroundColor: statusColor }} />
          <AppText variant="small" color={statusColor} style={{ fontWeight: "700" }}>
            {ORDER_STATUS_LABELS[order.status]}
          </AppText>
        </View>
      </View>

      {expanded ? (
        <View style={{ gap: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
          {order.items.map((item) => (
            <OrderItemRow key={item.id} item={item} downloadable={downloadable} />
          ))}
          {order.address ? (
            <View style={{ gap: 2 }}>
              <AppText variant="small" color={colors.textFaint} style={{ letterSpacing: 1 }}>
                LIVRAISON
              </AppText>
              <AppText variant="bodyMuted">
                {order.address.recipientName} · {order.address.phone}
              </AppText>
              <AppText variant="bodyMuted">
                {order.address.addressLine ? `${order.address.addressLine}, ` : ""}
                {order.address.area ? `${order.address.area}, ` : ""}
                {order.address.city}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : (
        <AppText variant="small" color={colors.primary} style={{ fontWeight: "600" }}>
          Détails
        </AppText>
      )}
    </Pressable>
  );
}

function OrderItemRow({ item, downloadable }: { item: OrderItem; downloadable: boolean }) {
  const { colors } = useTheme();
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function download() {
    setDownloading(true);
    setMessage(null);
    try {
      const dir = new Directory(Paths.cache, "purchases");
      await dir.create({ intermediates: true, idempotent: true });
      const safeName = `${item.productName.replace(/[^a-zA-Z0-9.-]/g, "_")}-${item.id}`;
      const target = new File(dir, safeName);
      // Session cookies are attached by the native cookie store automatically.
      const task = File.createDownloadTask(`${API_URL}/api/v1/orders/${item.orderId}/items/${item.id}/download`, target);
      const file = await task.downloadAsync();
      if (file?.exists && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(file.uri);
      }
      setMessage("Téléchargement terminé");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  const canDownload = downloadable && item.productType === "DIGITAL";
  const limitReached = item.downloadLimit != null && item.downloadCount >= item.downloadLimit;

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
        <AppText variant="body" style={{ flex: 1 }}>
          {item.productName}
          {item.variantName ? ` (${item.variantName})` : ""}
        </AppText>
        <AppText variant="body">{formatMoney(item.lineTotal)}</AppText>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <AppText variant="small" color={colors.textFaint}>
          {item.productType === "DIGITAL"
            ? item.downloadLimit != null
              ? `Digital · ${item.downloadCount}/${item.downloadLimit} téléchargements`
              : "Digital · téléchargements illimités"
            : "Physique"}
        </AppText>
        {canDownload && !limitReached ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void download()}
            disabled={downloading}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Ionicons name="download" size={14} color={colors.accent} />
            <AppText variant="small" color={colors.accent} style={{ fontWeight: "700" }}>
              {downloading ? "Téléchargement…" : "Télécharger"}
            </AppText>
          </Pressable>
        ) : null}
        {limitReached ? <AppText variant="small" color={colors.danger}>Limite atteinte</AppText> : null}
      </View>
      {message ? <AppText variant="small" color={colors.textFaint}>{message}</AppText> : null}
    </View>
  );
}
