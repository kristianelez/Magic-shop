import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, TrendingUp } from "lucide-react";

interface CustomerCardProps {
  id: string;
  name: string;
  company: string;
  lastContact?: string;
  totalPurchases: number;
  status: "active" | "inactive" | "vip";
  favoriteProducts?: string[];
}

export function CustomerCard({
  id,
  name,
  company,
  lastContact,
  totalPurchases,
  status,
  favoriteProducts = [],
}: CustomerCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const statusColors = {
    active: "bg-primary/10 text-primary border-primary/20",
    inactive: "bg-muted text-muted-foreground",
    vip: "bg-primary text-primary-foreground",
  };

  const statusLabels = {
    active: "Aktivan",
    inactive: "Neaktivan",
    vip: "VIP",
  };

  return (
    <Card className="hover-elevate cursor-pointer" data-testid={`card-customer-${id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-base" data-testid="text-customer-name">{name}</h3>
            <p className="text-sm text-muted-foreground">{company}</p>
          </div>
        </div>
        <Badge className={statusColors[status]} variant="outline">
          {statusLabels[status]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Zadnji kontakt:</span>
          <span className="font-medium">{lastContact || "Nikad"}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Ukupna vrijednost:</span>
          <span className="font-semibold text-primary">{totalPurchases.toLocaleString()} KM</span>
        </div>
        {favoriteProducts.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Najčešći proizvodi:</p>
            <div className="flex flex-wrap gap-1">
              {favoriteProducts.slice(0, 2).map((product, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {product}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" className="flex-1" data-testid="button-call">
            <Phone className="h-3 w-3 mr-1" />
            Pozovi
          </Button>
          <Button size="sm" variant="outline" className="flex-1" data-testid="button-email">
            <Mail className="h-3 w-3 mr-1" />
            Email
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
