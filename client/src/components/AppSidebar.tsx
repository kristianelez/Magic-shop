import { LayoutDashboard, Users, Package, Sparkles, ShoppingCart, ClipboardList, FileText, Trophy, BarChart3, Bell, RotateCcw, UserSearch } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
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

const menuItems = [
  {
    title: "Analitika",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Nova narudžba",
    url: "/create-order",
    icon: ShoppingCart,
  },
  {
    title: "Povrat robe",
    url: "/create-return",
    icon: RotateCcw,
  },
  {
    title: "Narudžbe",
    url: "/orders",
    icon: ClipboardList,
  },
  {
    title: "Kupci",
    url: "/customers",
    icon: Users,
  },
  {
    title: "Analiza kupca",
    url: "/customer-analysis",
    icon: UserSearch,
  },
  {
    title: "Proizvodi",
    url: "/products",
    icon: Package,
  },
  {
    title: "Preporuke u prodaji",
    url: "/recommendations",
    icon: Sparkles,
  },
  {
    title: "Kontaktiranje kupaca",
    url: "/contacts",
    icon: Bell,
  },
  {
    title: "Ponude",
    url: "/offers",
    icon: FileText,
  },
  {
    title: "Bonusi",
    url: "/bonuses",
    icon: Trophy,
  },
  {
    title: "Statistika",
    url: "/statistika",
    icon: BarChart3,
  },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  const { user } = useAuth();

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
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-sidebar-foreground">Magic Shop</h2>
            <p className="text-xs text-muted-foreground">{userRoleDisplay}</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigacija</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase()}`}
                    onClick={() => handleLinkClick(item.url)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
