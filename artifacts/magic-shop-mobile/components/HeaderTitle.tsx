import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Logo } from "@/components/Logo";
import { useColors } from "@/hooks/useColors";

export function HeaderTitle({ title }: { title: string }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Logo size={28} ring={false} />
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
