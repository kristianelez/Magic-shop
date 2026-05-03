import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "./api";

const LAST_REGISTERED_TOKEN: { value: string | null } = { value: null };

function resolveProjectId(): string | undefined {
  // EAS projectId — Expo Push API ga zahtijeva u SDK 49+ kad app radi van
  // klasičnog Expo Go-a. U dev-u često nije postavljen, pa fallback-amo na
  // legacy `expoConfig.extra.eas.projectId` ili `easConfig.projectId`.
  const expoCfg = Constants.expoConfig;
  return (
    (expoCfg?.extra as { eas?: { projectId?: string } } | undefined)?.eas
      ?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig
      ?.projectId
  );
}

/**
 * Traži dozvolu za notifikacije, dohvati Expo push token i registruje ga
 * na serveru. Tiho izlazi (vraća null) ako:
 *   - radimo na webu ili simulatoru bez push podrške
 *   - korisnik je odbio dozvolu
 *   - getExpoPushTokenAsync padne (npr. nema EAS projectId)
 *
 * Ne baca greške — push obavijesti su "nice to have", ne smiju srušiti login.
 */
export async function registerPushTokenWithServer(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) {
    console.log("[push] Skipping push registration on simulator/emulator");
    return null;
  }

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== "granted") {
      console.log("[push] Permission not granted — skipping registration");
      return null;
    }

    const projectId = resolveProjectId();
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult.data;
    if (!token) return null;

    if (LAST_REGISTERED_TOKEN.value === token) {
      return token;
    }

    await api("/api/push-tokens", {
      method: "POST",
      body: { token, platform: Platform.OS },
    });
    LAST_REGISTERED_TOKEN.value = token;
    return token;
  } catch (err) {
    console.warn("[push] Failed to register push token:", err);
    return null;
  }
}

/**
 * Pri logout-u brišemo token sa servera tako da bivši korisnik prestane
 * dobijati notifikacije na ovaj uređaj.
 */
export async function unregisterPushTokenWithServer(): Promise<void> {
  const token = LAST_REGISTERED_TOKEN.value;
  if (!token) return;
  try {
    await api("/api/push-tokens", { method: "DELETE", body: { token } });
  } catch (err) {
    console.warn("[push] Failed to unregister push token:", err);
  } finally {
    LAST_REGISTERED_TOKEN.value = null;
  }
}
