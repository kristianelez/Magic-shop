import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, Pencil, MessageSquare, Users, Calendar, CreditCard, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { AddCustomerDialog } from "./AddCustomerDialog";
import type { Customer } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CustomerCardProps {
  customer: Customer;
  lastContact?: string;
  totalPurchases: number;
  favoriteProducts?: string[];
}

export function CustomerCard({
  customer,
  lastContact,
  totalPurchases,
  favoriteProducts = [],
}: CustomerCardProps) {
  const { id, name, company, email, phone, status, customerType, paymentTerms } = customer;
  const [, setLocation] = useLocation();
  
  const recordCallMutation = useMutation({
    mutationFn: async (customerId: number) => {
      return await apiRequest("POST", `/api/activities/call/${customerId}`);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['/api/customers'] });
    },
  });

  const handleCallClick = async () => {
    if (phone) {
      try {
        await recordCallMutation.mutateAsync(id);
        const telLink = document.createElement('a');
        telLink.href = `tel:${normalizePhoneForTel(phone)}`;
        telLink.click();
      } catch (error) {
        console.error("Failed to record call:", error);
        const telLink = document.createElement('a');
        telLink.href = `tel:${normalizePhoneForTel(phone)}`;
        telLink.click();
      }
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const normalizePhoneForTel = (phoneNumber: string) => {
    const hasPlus = phoneNumber.startsWith('+');
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    return hasPlus ? `+${digitsOnly}` : digitsOnly;
  };

  const statusColors = {
    active: "bg-primary/10 text-primary border-primary/20",
    inactive: "bg-muted text-muted-foreground",
    vip: "bg-primary text-primary-foreground",
    potential: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  };

  const statusLabels = {
    active: "Aktivan",
    inactive: "Neaktivan",
    vip: "VIP",
    potential: "Potencijalni",
  };

  const customerTypeLabels: Record<string, string> = {
    hotel: "Hotel",
    pekara: "Pekara",
    kafic: "Kafić",
    restoran: "Restoran",
    fabrika: "Fabrika",
    ostalo: "Ostalo",
  };

  return (
    <Card className="hover-elevate" data-testid={`card-customer-${id}`}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Avatar className="flex-shrink-0 h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <h3 className="font-semibold text-base truncate" data-testid="text-customer-name">{name}</h3>
            </div>
            <p className="text-sm text-muted-foreground truncate">{company}</p>
          </div>
          <AddCustomerDialog
            customer={customer}
            trigger={
              <Button size="icon" variant="ghost" className="flex-shrink-0" data-testid={`button-edit-customer-${id}`}>
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={`${statusColors[status as "active" | "inactive" | "vip" | "potential"]} flex-shrink-0`} variant="outline">
            {statusLabels[status as "active" | "inactive" | "vip" | "potential"]}
          </Badge>
          {customerType && customerType !== "ostalo" && (
            <Badge variant="secondary" className="flex-shrink-0">
              {customerTypeLabels[customerType]}
            </Badge>
          )}
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground">Zadnji kontakt:</span>
            <span className="text-sm font-medium ml-auto">{lastContact || "Nikad"}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground">Ukupna vrijednost:</span>
            <span className="text-sm font-semibold text-primary ml-auto">{totalPurchases.toLocaleString()} KM</span>
          </div>
          
          {paymentTerms && (
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">Plaćanje:</span>
              <span className="text-sm font-medium ml-auto">{paymentTerms}</span>
            </div>
          )}
        </div>

        {favoriteProducts.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Najčešći proizvodi:</p>
            <div className="flex flex-wrap gap-1">
              {favoriteProducts.slice(0, 2).map((product, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs truncate max-w-[150px]">
                  {product}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 min-w-[100px]"
            data-testid="button-call"
            onClick={handleCallClick}
            disabled={!phone || recordCallMutation.isPending}
          >
            <Phone className="h-3 w-3 mr-1" />
            Pozovi
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 min-w-[100px]"
            data-testid={`button-view-conversations-${id}`}
            onClick={() => setLocation(`/customers/${id}`)}
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            Razgovori
          </Button>
          {email ? (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 min-w-[100px]"
              data-testid="button-email"
              asChild
            >
              <a href={`mailto:${email}`}>
                <Mail className="h-3 w-3 mr-1" />
                Email
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 min-w-[100px]"
              data-testid="button-email"
              disabled
            >
              <Mail className="h-3 w-3 mr-1" />
              Email
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
