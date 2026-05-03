import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { storage } from "./storage";

// =============================================================================
// Expo Push notifikacije — slanje vlasniku/admin/sales_director ulogama
// =============================================================================
// Koristi besplatni Expo Push servis (https://exp.host). Svi tokeni se čuvaju
// u tablici `push_tokens`; ovaj modul učita sve tokene odgovarajućih uloga,
// pošalje poruku u batch-evima i očisti nevažeće (DeviceNotRegistered).
//
// Sve greške hvata interno — pad slanja push-a NE smije srušiti kreiranje
// narudžbe (poziva se "fire and forget" iz routes.ts).
// =============================================================================

const expo = new Expo();

export interface NewOrderPushPayload {
  saleId: number;
  customerId: number;
  customerName: string;
  customerCompany?: string | null;
  salesPersonName: string;
  productName: string;
  quantity: number;
  totalAmount: string;
}

const OWNER_ROLES = ["admin", "sales_director"] as const;

export async function sendNewOrderPush(payload: NewOrderPushPayload): Promise<void> {
  let tokens: string[] = [];
  try {
    const rows = await storage.getPushTokensByRoles([...OWNER_ROLES]);
    tokens = rows.map((r) => r.token).filter((t) => Expo.isExpoPushToken(t));
  } catch (err) {
    console.error("[push] Failed to load tokens:", err);
    return;
  }

  if (tokens.length === 0) {
    console.log("[push] No registered push tokens for owner roles — skipping");
    return;
  }

  const company = payload.customerCompany?.trim();
  const buyer = company ? `${payload.customerName} (${company})` : payload.customerName;
  const title = "Nova narudžba";
  const body =
    `${payload.salesPersonName} — ${buyer}: ` +
    `${payload.quantity}× ${payload.productName} • ${payload.totalAmount} KM`;

  const messages: ExpoPushMessage[] = tokens.map((to) => ({
    to,
    title,
    body,
    sound: "default",
    priority: "high",
    data: {
      type: "new_order",
      saleId: payload.saleId,
      customerId: payload.customerId,
    },
  }));

  const tickets: ExpoPushTicket[] = [];
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...chunkTickets);
    } catch (err) {
      console.error("[push] Error sending chunk:", err);
    }
  }

  // Očisti tokene koji više nisu validni (uređaj odjavljen / app deinstaliran).
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (ticket.status === "error") {
      const errCode = ticket.details?.error;
      const failedToken = messages[i]?.to;
      console.error(
        `[push] Ticket error (${errCode ?? "unknown"}) for token ${failedToken}: ${ticket.message}`,
      );
      if (errCode === "DeviceNotRegistered" && typeof failedToken === "string") {
        try {
          await storage.deletePushToken(failedToken);
        } catch (err) {
          console.error("[push] Failed to delete invalid token:", err);
        }
      }
    }
  }
}

export function logPushStatus(): void {
  console.log("[push] Expo push notifications: enabled");
}
