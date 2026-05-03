import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { api } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

interface Sale {
  id: number;
  customerId: number;
  customerName?: string;
  total: string;
  status?: string;
  createdAt: string;
  invoiceNumber?: string | null;
}

function formatBAM(value: string | number) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return "0,00 KM";
  return (
    n.toLocaleString("bs-BA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    " KM"
  );
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("bs-BA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export default function OrdersScreen() {
  const colors = useColors();
  const router = useRouter();

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["sales"],
    queryFn: () => api<Sale[]>("/api/sales"),
  });

  const renderItem = useCallback(
    ({ item }: { item: Sale }) => (
      <TouchableOpacity
        onPress={() => router.push(`/sale/${item.id}` as never)}
        activeOpacity={0.85}
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.customer, { color: colors.foreground }]}>
                {item.customerName || `Kupac #${item.customerId}`}
              </Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {formatDate(item.createdAt)}
                {item.invoiceNumber ? `  •  Faktura ${item.invoiceNumber}` : ""}
              </Text>
            </View>
            <Text style={[styles.total, { color: colors.copper }]}>
              {formatBAM(item.total)}
            </Text>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </View>
        </View>
      </TouchableOpacity>
    ),
    [colors, router]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.copper} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive }}>
            Greška pri učitavanju narudžbi
          </Text>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={32} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>
                Još nema narudžbi
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.copper}
            />
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.copper }]}
        onPress={() => router.push("/new-order")}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 64 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  customer: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  total: { fontSize: 16, fontFamily: "Inter_700Bold" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
});
