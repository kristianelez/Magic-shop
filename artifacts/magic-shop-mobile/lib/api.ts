import AsyncStorage from "@react-native-async-storage/async-storage";

const COOKIE_KEY = "magic_shop_session_cookie";

let cachedCookie: string | null = null;

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

export async function loadCookie(): Promise<string | null> {
  if (cachedCookie) return cachedCookie;
  const stored = await AsyncStorage.getItem(COOKIE_KEY);
  cachedCookie = stored;
  return stored;
}

export async function setCookie(cookie: string | null): Promise<void> {
  cachedCookie = cookie;
  if (cookie) {
    await AsyncStorage.setItem(COOKIE_KEY, cookie);
  } else {
    await AsyncStorage.removeItem(COOKIE_KEY);
  }
}

function parseSetCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;
  const first = setCookieHeader.split(",")[0];
  const pair = first.split(";")[0];
  return pair.trim();
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
  const cookie = await loadCookie();
  const url = `${getBaseUrl()}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (cookie) headers["Cookie"] = cookie;

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
  });

  const setCookieHeader = res.headers.get("set-cookie");
  const parsed = parseSetCookie(setCookieHeader);
  if (parsed) {
    await setCookie(parsed);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
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
