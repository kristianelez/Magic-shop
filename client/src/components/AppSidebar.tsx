import { LayoutDashboard, Users, Package, Sparkles, ShoppingCart, ClipboardList, FileText, Trophy, BarChart3, Bell, RotateCcw, UserSearch, Tag } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Product } from "@shared/schema";
import type { LucideIcon } from "lucide-react";

type MenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  key?: "akcije";
};

const menuItems: MenuItem[] = [
  { title: "Analitika", url: "/", icon: LayoutDashboard },
  { title: "Nova narudžba", url: "/create-order", icon: ShoppingCart },
  { title: "Povrat robe", url: "/create-return", icon: RotateCcw },
  { title: "Narudžbe", url: "/orders", icon: ClipboardList },
  { title: "Kupci", url: "/customers", icon: Users },
  { title: "Analiza kupca", url: "/customer-analysis", icon: UserSearch },
  { title: "Proizvodi", url: "/products", icon: Package },
  { title: "Akcije", url: "/products?category=akcija", icon: Tag, key: "akcije" },
  { title: "Preporuke u prodaji", url: "/recommendations", icon: Sparkles },
  { title: "Kontaktiranje kupaca", url: "/contacts", icon: Bell },
  { title: "Ponude", url: "/offers", icon: FileText },
  { title: "Bonusi", url: "/bonuses", icon: Trophy },
  { title: "Statistika", url: "/statistika", icon: BarChart3 },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  const { user } = useAuth();

  const { data: activePromos = [] } = useQuery<Product[]>({
    queryKey: ["/api/products/active-promotions"],
    staleTime: 5 * 60 * 1000,
  });

  const handleLinkClick = (url: string) => {
    setLocation(url);
    if (isMobile) {
      requestAnimationFrame(() => {
        setOpenMobile(false);
      });
    }
  };

  const userRoleDisplay = user?.role === 'admin' ? "Admin" : "Komercijalista";

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <Logo size={44} ring={false} className="ring-2 ring-sidebar-primary/50" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-sidebar-foreground leading-tight truncate">
              Magic Cosmetic
            </h2>
            <p className="text-xs text-sidebar-foreground/70 truncate">{userRoleDisplay}</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigacija</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isAkcije = item.key === "akcije";
                const search = typeof window !== "undefined" ? window.location.search : "";
                const isActive = isAkcije
                  ? location === "/products" && search.includes("category=akcija")
                  : item.url === "/products"
                    ? location === "/products" && !search.includes("category=akcija")
                    : location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      onClick={() => handleLinkClick(item.url)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1 truncate">{item.title}</span>
                      {isAkcije && activePromos.length > 0 && (
                        <Badge
                          variant="destructive"
                          className="ml-auto h-5 min-w-5 justify-center px-1.5 text-[10px]"
                          data-testid="badge-akcije-count"
                        >
                          {activePromos.length}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
