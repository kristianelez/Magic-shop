import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken } from "@/lib/api";
import {
  registerPushTokenWithServer,
  unregisterPushTokenWithServer,
} from "@/lib/push";

interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: User }>("/api/auth/me");
      setUser(data.user);
      // Ako je sesija već aktivna (npr. nakon restartanja app-a), pokušaj
      // re-registrovati push token — fire & forget, ne čekamo rezultat.
      registerPushTokenWithServer().catch(() => {});
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await api<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    setUser(data.user);
    // Registracija push tokena nakon uspješne prijave — ne blokira UI.
    registerPushTokenWithServer().catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    // Pokušaj odjaviti push token PRIJE rušenja sesije, kako bi DELETE prošao
    // kroz requireAuth middleware. Greške ignorišemo (nije kritično).
    await unregisterPushTokenWithServer();
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {}
    await setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
