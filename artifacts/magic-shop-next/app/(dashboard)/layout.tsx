"use client";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/AppSidebar";
import { BrandedSidebarTrigger } from "@/components/BrandedSidebarTrigger";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { SplashScreen } from "@/components/SplashScreen";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useRouter } from "next/navigation";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout", {}),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["/api/auth/me"] });
      router.push("/login");
    },
  });

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isLoading) {
    return <SplashScreen label="Provjera prijave..." />;
  }

  if (!user) {
    return <SplashScreen label="Provjera prijave..." />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="relative shrink-0 flex items-center justify-between px-3 md:px-5 h-16 md:h-[68px] border-b border-border gap-2 md:gap-4 bg-gradient-to-r from-background via-background to-primary/5 z-50 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-primary/40 after:to-transparent">
            <div className="flex items-center gap-3 md:gap-4 min-w-0">
              <BrandedSidebarTrigger />
              <div className="flex items-center gap-3 min-w-0">
                <Logo size={40} className="hidden sm:block" />
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate text-sm md:text-base leading-tight" data-testid="text-username">
                    {user.fullName}
                  </div>
                  <div className="text-xs text-muted-foreground hidden sm:block truncate">
                    {user.role === "admin"
                      ? "Admin"
                      : user.role === "sales_director"
                        ? "Direktor prodaje"
                        : "Komercijalista"}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                data-testid="button-logout"
                className="hidden sm:flex"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Odjavi se
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                data-testid="button-logout-mobile"
                className="sm:hidden"
              >
                <LogOut className="h-4 w-4" />
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-4 lg:p-6">
            <div className="max-w-[100vw] md:max-w-none">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}
