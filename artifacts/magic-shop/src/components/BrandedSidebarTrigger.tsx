import { Menu, X } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface BrandedSidebarTriggerProps {
  className?: string;
}

export function BrandedSidebarTrigger({ className }: BrandedSidebarTriggerProps) {
  const { toggleSidebar, open, openMobile, isMobile } = useSidebar();
  const isOpen = isMobile ? openMobile : open;

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={isOpen ? "Zatvori meni" : "Otvori meni"}
      data-testid="button-sidebar-toggle"
      className={cn(
        "group relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
        "bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5",
        "border border-primary/30 shadow-sm",
        "text-primary transition-all duration-200",
        "hover:from-primary/25 hover:via-primary/20 hover:to-primary/10",
        "hover:border-primary/50 hover:shadow-md hover:scale-105",
        "active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <Menu
        className={cn(
          "h-6 w-6 absolute transition-all duration-300",
          isOpen ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100",
        )}
        strokeWidth={2.5}
      />
      <X
        className={cn(
          "h-6 w-6 absolute transition-all duration-300",
          isOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75",
        )}
        strokeWidth={2.5}
      />
    </button>
  );
}
