import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "magic_shop_session_token";

let cachedToken: string | null = null;

/**
 * Resolve the API base URL.
 *
 * Resolution order:
 *  1. `EXPO_PUBLIC_API_URL` — explicit override (set this for production
 *     builds, e.g. `https://magic-shop.replit.app`).
 *  2. `EXPO_PUBLIC_DOMAIN` — Replit dev preview hostname injected by the
 *     workflow (`$REPLIT_DEV_DOMAIN`). Used during local development so the
 *     app talks to the same workspace's API server through the shared proxy.
 *  3. Empty string — falls back to relative URLs (only useful when the API
 *     is served from the same origin as the app, e.g. on web preview).
 */
function getBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const devDomain = process.env.EXPO_PUBLIC_DOMAIN;
  if (devDomain) return `https://${devDomain}`;
  return "";
}

export async function loadToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  const stored = await AsyncStorage.getItem(TOKEN_KEY);
  cachedToken = stored;
  return stored;
}

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token;
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T = unknown>(
  path: string,
  opts: ApiOptions = {},
): Promise<T> {
  const token = await loadToken();
  const url = `${getBaseUrl()}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  // If the login response carries a sessionToken, persist it so subsequent
  // requests can authenticate via Authorization: Bearer (works in
  // cross-origin web preview where third-party cookies are blocked, and on
  // native where there is no shared cookie jar with the API host).
  if (
    data &&
    typeof data === "object" &&
    "sessionToken" in data &&
    typeof (data as { sessionToken?: unknown }).sessionToken === "string"
  ) {
    await setToken((data as { sessionToken: string }).sessionToken);
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    if (data && typeof data === "object") {
      const obj = data as { message?: unknown; error?: unknown };
      if (typeof obj.message === "string") message = obj.message;
      else if (typeof obj.error === "string") message = obj.error;
    }
    throw new ApiError(message, res.status);
  }

  return data as T;
}
