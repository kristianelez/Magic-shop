"use client";

import { LayoutDashboard, Users, Package, Sparkles, ShoppingCart, ClipboardList, FileText, Trophy, BarChart3, Bell, RotateCcw, UserSearch, Tag } from "lucide-react";
import { Logo } from "@/components/Logo";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import type { Product } from "@workspace/db/schema";
import type { LucideIcon } from "lucide-react";

type MenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  key?: "akcije";
};

const menuItems: MenuItem[] = [
  { title: "Analitika", url: "/", icon: LayoutDashboard },
  { title: "Nova narudžba", url: "/orders/create", icon: ShoppingCart },
  { title: "Povrat robe", url: "/returns/create", icon: RotateCcw },
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
  const pathname = usePathname();
  const router = useRouter();
  const searchParamsObj = useSearchParams();
  const search = searchParamsObj.toString();
  const { setOpenMobile, isMobile } = useSidebar();
  const { user } = useAuth();

  const { data: activePromos = [] } = useQuery<Product[]>({
    queryKey: ["/api/products/active-promotions"],
    staleTime: 5 * 60 * 1000,
  });

  const handleLinkClick = (url: string) => {
    router.push(url);
    if (isMobile) {
      requestAnimationFrame(() => {
        setOpenMobile(false);
      });
    }
  };

  const userRoleDisplay = user?.role === 'admin' ? "Admin" : "Komercijalista";

  return (
    <Sidebar>
      <SidebarHeader className="relative p-5 border-b border-sidebar-border bg-gradient-to-br from-sidebar via-sidebar to-sidebar-accent/30">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-sidebar-primary/30 blur-xl" />
            <Logo
              size={72}
              ring={false}
              className="relative ring-2 ring-sidebar-primary/60 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
            />
          </div>
          <div className="min-w-0 w-full">
            <h2 className="text-lg font-bold text-sidebar-foreground leading-tight truncate tracking-tight">
              Magic Cosmetic
            </h2>
            <p className="text-[11px] uppercase tracking-[0.15em] text-sidebar-primary font-semibold mt-0.5">
              Shop CRM
            </p>
          </div>
          {user?.fullName && (
            <div className="w-full pt-2 mt-1 border-t border-sidebar-border/60">
              <p className="text-sm font-medium text-sidebar-foreground/95 truncate">
                {user.fullName}
              </p>
              <p className="text-[11px] text-sidebar-foreground/60 truncate">
                {userRoleDisplay}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigacija</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isAkcije = item.key === "akcije";
                const isPromoQuery = search.includes("category=akcija");
                const isActive = isAkcije
                  ? pathname === "/products" && isPromoQuery
                  : item.url === "/products"
                  ? pathname === "/products" && !isPromoQuery
                  : item.url === "/orders"
                  ? pathname === "/orders"
                  : pathname === item.url;
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
