import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Logo } from "@/components/Logo";

export default function MoreScreen() {
  const colors = useColors();
  const { user, logout } = useAuth();

  const onLogout = () => {
    Alert.alert("Odjava", "Da li ste sigurni da se želite odjaviti?", [
      { text: "Otkaži", style: "cancel" },
      {
        text: "Odjavi se",
        style: "destructive",
        onPress: () => {
          logout();
        },
      },
    ]);
  };

  const roleLabel = (role?: string) => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "sales_director":
        return "Direktor prodaje";
      case "sales_manager":
        return "Menadžer prodaje";
      case "komercijalista":
        return "Komercijalista";
      default:
        return role || "";
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.profileCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Logo size={64} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.foreground }]}>
            {user?.fullName || "Korisnik"}
          </Text>
          <Text style={[styles.username, { color: colors.mutedForeground }]}>
            {user?.username}
          </Text>
          <Text style={[styles.role, { color: colors.copper }]}>
            {roleLabel(user?.role)}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={onLogout}
        activeOpacity={0.8}
      >
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={[styles.rowText, { color: colors.destructive }]}>Odjavi se</Text>
      </TouchableOpacity>

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        Magic Cosmetic Shop CRM
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  name: { fontSize: 17, fontFamily: "Inter_700Bold" },
  username: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  role: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  rowText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  footer: {
    marginTop: "auto",
    textAlign: "center",
    fontSize: 12,
    paddingVertical: 16,
  },
});
