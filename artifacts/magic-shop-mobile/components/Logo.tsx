import React from "react";
import { Image, View, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

interface LogoProps {
  size?: number;
  ring?: boolean;
}

export function Logo({ size = 56, ring = true }: LogoProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring ? 2 : 0,
          borderColor: colors.copper + "66",
          backgroundColor: colors.navyDeep,
        },
      ]}
    >
      <Image
        source={require("../assets/images/icon.png")}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
