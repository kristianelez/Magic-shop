import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

SplashScreen.preventAutoHideAsync();

// Foreground notification handler — kada je app otvorena i stigne push,
// želimo prikazati banner i odsvirati zvuk umjesto da samo tihi event padne.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

interface NewOrderNotificationData {
  type?: string;
  saleId?: number;
  customerId?: number;
}

function isNewOrderData(data: unknown): data is NewOrderNotificationData {
  return !!data && typeof data === "object" && (data as { type?: string }).type === "new_order";
}

function RootLayoutNav() {
  const colors = useColors();
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const handledInitialNotification = useRef(false);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "login";
    if (!user && !inAuthGroup) {
      router.replace("/login");
    } else if (user && inAuthGroup) {
      router.replace("/");
    }
  }, [user, loading, segments, router]);

  // Push notifikacije: klik na notifikaciju otvara detalj kupca/narudžbe.
  // Mobilna app trenutno nema poseban "sale detail" ekran, pa rutamo na
  // detalj kupca koji nosi sve narudžbe za njega.
  useEffect(() => {
    if (!user) return;

    const handleData = (data: unknown) => {
      if (!isNewOrderData(data)) return;
      if (typeof data.customerId === "number") {
        router.push(`/customer/${data.customerId}`);
      }
    };

    // App je startovala iz zatvorenog stanja klikom na notifikaciju.
    if (!handledInitialNotification.current) {
      handledInitialNotification.current = true;
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) handleData(response.notification.request.content.data);
        })
        .catch(() => {});
    }

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleData(response.notification.request.content.data);
    });
    return () => sub.remove();
  }, [user, router]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.sidebar },
        headerTintColor: colors.copperLight,
        headerTitleStyle: { color: colors.sidebarForeground, fontFamily: "Inter_600SemiBold" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen
        name="new-order"
        options={{ title: "Nova narudžba", presentation: "modal" }}
      />
      <Stack.Screen name="customer/[id]" options={{ title: "Detalji kupca" }} />
      <Stack.Screen name="product/[id]" options={{ title: "Detalji proizvoda" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <RootLayoutNav />
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
