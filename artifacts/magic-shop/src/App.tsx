import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
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
import { Logo } from "@/components/Logo";
import { SplashScreen } from "@/components/SplashScreen";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Customers = lazy(() => import("@/pages/Customers"));
const CustomerDetail = lazy(() => import("@/pages/CustomerDetail"));
const CustomerAnalysis = lazy(() => import("@/pages/CustomerAnalysis"));
const Products = lazy(() => import("@/pages/Products"));
const CreateOrder = lazy(() => import("@/pages/CreateOrder"));
const CreateReturn = lazy(() => import("@/pages/CreateReturn"));
const EditOrder = lazy(() => import("@/pages/EditOrder"));
const EditOffer = lazy(() => import("@/pages/EditOffer"));
const Orders = lazy(() => import("@/pages/Orders"));
const Offers = lazy(() => import("@/pages/Offers"));
const Bonuses = lazy(() => import("@/pages/Bonuses"));
const Statistika = lazy(() => import("@/pages/Statistika"));
const AIRecommendations = lazy(() => import("@/pages/AIRecommendations"));
const CustomerContacts = lazy(() => import("@/pages/CustomerContacts"));
const Login = lazy(() => import("@/pages/Login"));
const NotFound = lazy(() => import("@/pages/not-found"));

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center h-64 gap-3">
    <Logo size={56} />
    <p className="text-sm text-muted-foreground">Učitavanje...</p>
  </div>
);

function Router() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={Dashboard} />
        <Route path="/customers" component={Customers} />
        <Route path="/customer-analysis" component={CustomerAnalysis} />
        <Route path="/customers/:customerId" component={CustomerDetail} />
        <Route path="/products" component={Products} />
        <Route path="/recommendations" component={AIRecommendations} />
        <Route path="/contacts" component={CustomerContacts} />
        <Route path="/offers" component={Offers} />
        <Route path="/edit-offer/:offerId" component={EditOffer} />
        <Route path="/bonuses" component={Bonuses} />
        <Route path="/statistika" component={Statistika} />
        <Route path="/create-order" component={CreateOrder} />
        <Route path="/create-return" component={CreateReturn} />
        <Route path="/edit-order/:orderId" component={EditOrder} />
        <Route path="/orders" component={Orders} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
    return <SplashScreen label="Provjera prijave..." />;
  }

  if (location === "/login" || !user) {
    return <Router />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="shrink-0 flex items-center justify-between px-3 md:px-5 h-16 border-b border-border gap-2 md:gap-4 bg-background z-50">
            <div className="flex items-center gap-3 md:gap-4 min-w-0">
              {/* Veći hamburger meni — h-11 w-11 sa 24px ikonom, lakši za klik */}
              <SidebarTrigger
                data-testid="button-sidebar-toggle"
                className="shrink-0 h-11 w-11 [&_svg]:h-6 [&_svg]:w-6"
              />
              <div className="flex items-center gap-3 min-w-0">
                <Logo size={36} className="hidden sm:block" />
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
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
            <Toaster />
          </WouterRouter>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
