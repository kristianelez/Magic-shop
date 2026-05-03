import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { api } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

interface CustomerDetail {
  id: number;
  name: string;
  company: string;
  email?: string | null;
  phone?: string | null;
  customerType?: string | null;
  paymentTerms?: string | null;
  totalPurchases?: number;
  lastContact?: string;
  sales?: Array<{ id: number; total: string; createdAt: string }>;
}

function formatBAM(value: string | number) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return "0,00 KM";
  return n.toLocaleString("bs-BA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " KM";
}

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { data, isLoading, error } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api<CustomerDetail>(`/api/customers/${id}`),
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
        <Text style={{ color: colors.destructive }}>Kupac nije pronađen</Text>
      </View>
    );
  }

  const Item = ({ icon, label, value }: { icon: any; label: string; value?: string | null }) =>
    value ? (
      <View style={styles.row}>
        <Feather name={icon} size={16} color={colors.mutedForeground} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
          <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
        </View>
      </View>
    ) : null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>{data.company}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {data.name}
        </Text>
        {data.totalPurchases != null && (
          <Text style={[styles.totalLine, { color: colors.copper }]}>
            Ukupno kupovina: {formatBAM(data.totalPurchases)}
          </Text>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
        <Item icon="phone" label="Telefon" value={data.phone || undefined} />
        <Item icon="mail" label="Email" value={data.email || undefined} />
        <Item icon="tag" label="Tip kupca" value={data.customerType || undefined} />
        <Item icon="credit-card" label="Uslovi plaćanja" value={data.paymentTerms || undefined} />
        <Item icon="clock" label="Posljednji kontakt" value={data.lastContact} />
      </View>

      {data.sales && data.sales.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Posljednje narudžbe
          </Text>
          {data.sales.slice(0, 10).map((s) => (
            <View key={s.id} style={styles.saleRow}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {new Date(s.createdAt).toLocaleDateString("bs-BA")}
              </Text>
              <Text style={{ color: colors.copper, fontFamily: "Inter_600SemiBold" }}>
                {formatBAM(s.total)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
  totalLine: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.4 },
  value: { fontSize: 15, fontFamily: "Inter_500Medium", marginTop: 2 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  saleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
});
