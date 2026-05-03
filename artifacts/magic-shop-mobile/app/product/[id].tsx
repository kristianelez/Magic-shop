import React from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";

import { api } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

interface Product {
  id: number;
  name: string;
  category: string;
  price: string;
  stock: number;
  unit: string;
  description?: string | null;
  vendor?: string | null;
  promoPrice?: string | null;
  promoEndDate?: string | null;
}

function formatBAM(value: string | number) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return "0,00 KM";
  return n.toLocaleString("bs-BA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " KM";
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { data, isLoading, error } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api<Product>(`/api/products/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.copper} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.destructive }}>Proizvod nije pronađen</Text>
      </View>
    );
  }

  const Row = ({ icon, label, value }: { icon: FeatherIconName; label: string; value: string }) => (
    <View style={styles.row}>
      <Feather name={icon} size={16} color={colors.mutedForeground} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>{data.name}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{data.category}</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 12 }}>
          {data.promoPrice ? (
            <>
              <Text style={[styles.price, { color: colors.copper }]}>
                {formatBAM(data.promoPrice)}
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  textDecorationLine: "line-through",
                  fontSize: 14,
                }}
              >
                {formatBAM(data.price)}
              </Text>
            </>
          ) : (
            <Text style={[styles.price, { color: colors.copper }]}>
              {formatBAM(data.price)}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
        <Row icon="archive" label="Stanje" value={`${data.stock} ${data.unit}`} />
        {data.vendor ? <Row icon="truck" label="Dobavljač" value={data.vendor} /> : null}
        {data.description ? (
          <Row icon="file-text" label="Opis" value={data.description} />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  price: { fontSize: 22, fontFamily: "Inter_700Bold" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  label: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.4 },
  value: { fontSize: 15, fontFamily: "Inter_500Medium", marginTop: 2 },
});
