import { createContext, useContext, ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

type User = {
  id: string;
  username: string;
  fullName: string;
  role: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();

  const { data, isLoading } = useQuery<{ user: User }>({
    queryKey: ["/api/auth/me"],
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 30 * 60 * 1000, // Cache 30 min
  });

  const user = data?.user || null;
  const isAuthenticated = !!user;

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated && location !== "/login") {
        setLocation("/login");
      } else if (isAuthenticated && location === "/login") {
        setLocation("/");
      }
    }
  }, [isLoading, isAuthenticated, location, setLocation]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
