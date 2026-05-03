import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { HeaderTitle } from "@/components/HeaderTitle";
import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.copper,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerStyle: { backgroundColor: colors.sidebar },
        headerTintColor: colors.copperLight,
        headerTitleAlign: "left",
        tabBarStyle: {
          backgroundColor: colors.sidebar,
          borderTopColor: colors.sidebarBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Narudžbe",
          headerTitle: () => <HeaderTitleNavy title="Narudžbe" />,
          tabBarIcon: ({ color }) => (
            <Feather name="shopping-bag" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: "Kupci",
          headerTitle: () => <HeaderTitleNavy title="Kupci" />,
          tabBarIcon: ({ color }) => (
            <Feather name="users" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: "Proizvodi",
          headerTitle: () => <HeaderTitleNavy title="Proizvodi" />,
          tabBarIcon: ({ color }) => (
            <Feather name="package" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Više",
          headerTitle: () => <HeaderTitleNavy title="Više" />,
          tabBarIcon: ({ color }) => (
            <Feather name="more-horizontal" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function HeaderTitleNavy({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <HeaderTitle title={title} />
    </View>
  );
}
