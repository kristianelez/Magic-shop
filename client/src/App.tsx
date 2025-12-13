import { Switch, Route, useLocation } from "wouter";
import { Suspense, lazy } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { LogOut } from "lucide-react";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import CustomerDetail from "@/pages/CustomerDetail";
import Products from "@/pages/Products";
import CreateOrder from "@/pages/CreateOrder";
import EditOrder from "@/pages/EditOrder";
import Orders from "@/pages/Orders";
import Offers from "@/pages/Offers";
import Bonuses from "@/pages/Bonuses";
import Statistika from "@/pages/Statistika";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";

// Lazy load slow pages for faster initial load
const AIRecommendations = lazy(() => import("@/pages/AIRecommendations"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <p className="text-muted-foreground">Učitavanje...</p>
  </div>
);

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={Dashboard} />
      <Route path="/customers" component={Customers} />
      <Route path="/customers/:customerId" component={CustomerDetail} />
      <Route path="/products" component={Products} />
      <Route path="/recommendations">
        {() => (
          <Suspense fallback={<LoadingFallback />}>
            <AIRecommendations />
          </Suspense>
        )}
      </Route>
      <Route path="/offers" component={Offers} />
      <Route path="/bonuses" component={Bonuses} />
      <Route path="/statistika" component={Statistika} />
      <Route path="/create-order" component={CreateOrder} />
      <Route path="/edit-order/:orderId" component={EditOrder} />
      <Route path="/orders" component={Orders} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [location, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout", {}),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/login");
    },
  });

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Učitavanje...</div>
      </div>
    );
  }

  if (location === "/login" || !user) {
    return <Router />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          {/* Fixed Header - ostaje fiksiran na vrhu */}
          <header className="shrink-0 flex items-center justify-between p-3 md:p-4 border-b border-border gap-2 md:gap-4 bg-background z-50">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="shrink-0" />
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-foreground truncate text-sm md:text-base" data-testid="text-username">
                  {user.fullName}
                </span>
                <span className="text-xs md:text-sm text-muted-foreground hidden sm:inline truncate">
                  ({user.role === "admin" ? "Admin" : user.role === "sales_director" ? "Direktor prodaje" : "Sales manager"})
                </span>
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
          {/* Scrollable main content - prilagođen za sve uređaje */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-4 lg:p-6">
            <div className="max-w-[100vw] md:max-w-none">
              <Router />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider defaultTheme="light">
          <AuthProvider>
            <AppContent />
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
