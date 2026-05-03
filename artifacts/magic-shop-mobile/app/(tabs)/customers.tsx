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

interface Customer {
  id: number;
  name: string;
  company: string;
  customerType?: string | null;
  phone?: string | null;
  email?: string | null;
  totalPurchases?: number;
}

export default function CustomersScreen() {
  const colors = useColors();
  const router = useRouter();
  const [q, setQ] = useState("");

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api<Customer[]>("/api/customers"),
  });

  const filtered = useMemo(() => {
    const all = data ?? [];
    if (!q.trim()) return all;
    const needle = q.trim().toLowerCase();
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.company.toLowerCase().includes(needle)
    );
  }, [data, q]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Pretraži kupce..."
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
          <Text style={{ color: colors.destructive }}>Greška pri učitavanju kupaca</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/customer/${item.id}`)}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={{ color: colors.copper, fontFamily: "Inter_700Bold" }}>
                  {item.company.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
                  {item.company}
                </Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {item.name}
                  {item.phone ? `  •  ${item.phone}` : ""}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={32} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>
                Nema kupaca
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
