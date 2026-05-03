import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { api } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

interface Product {
  id: number;
  name: string;
  category: string;
  price: string;
  stock: number;
  unit: string;
  promoPrice?: string | null;
  promoEndDate?: string | null;
}

function formatBAM(value: string | number) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return "0,00 KM";
  return n.toLocaleString("bs-BA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " KM";
}

export default function ProductsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [q, setQ] = useState("");

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["products"],
    queryFn: () => api<Product[]>("/api/products"),
  });

  const filtered = useMemo(() => {
    const all = data ?? [];
    if (!q.trim()) return all;
    const needle = q.trim().toLowerCase();
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle)
    );
  }, [data, q]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Pretraži proizvode..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.copper} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive }}>Greška pri učitavanju proizvoda</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => {
            const onPromo = !!item.promoPrice;
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push(`/product/${item.id}`)}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.category}  •  Stanje: {item.stock} {item.unit}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {onPromo ? (
                    <>
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          textDecorationLine: "line-through",
                          fontSize: 11,
                          fontFamily: "Inter_400Regular",
                        }}
                      >
                        {formatBAM(item.price)}
                      </Text>
                      <Text style={[styles.price, { color: colors.copper }]}>
                        {formatBAM(item.promoPrice!)}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.price, { color: colors.copper }]}>
                      {formatBAM(item.price)}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="package" size={32} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>
                Nema proizvoda
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.copper} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 64 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  title: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  price: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
