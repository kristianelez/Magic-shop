"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Phone, Clock, Mail, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AIRecommendationCardProps {
  id: string;
  customerName: string;
  customerCompany: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  suggestedProducts: string[];
  reasoning: string;
  priority: "high" | "medium" | "low";
  optimalTime?: string;
}

export function AIRecommendationCard({
  id,
  customerName,
  customerCompany,
  customerEmail,
  customerPhone,
  suggestedProducts,
  reasoning,
  priority,
  optimalTime,
}: AIRecommendationCardProps) {
  const router = useRouter();

  const recordCallMutation = useMutation({
    mutationFn: async (customerId: number) => {
      return await apiRequest("POST", `/api/activities/call/${customerId}`);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['/api/customers'] });
    },
  });

  const handleCallClick = async () => {
    if (customerPhone) {
      try {
        await recordCallMutation.mutateAsync(parseInt(id));
        const telLink = document.createElement('a');
        telLink.href = `tel:${normalizePhoneForTel(customerPhone)}`;
        telLink.click();
      } catch (error) {
        console.error("Failed to record call:", error);
        const telLink = document.createElement('a');
        telLink.href = `tel:${normalizePhoneForTel(customerPhone)}`;
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

  const priorityColors = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-primary/10 text-primary border-primary/20",
    low: "bg-muted text-muted-foreground",
  };

  const priorityLabels = {
    high: "Visoki prioritet",
    medium: "Srednji prioritet",
    low: "Niski prioritet",
  };

  const normalizePhoneForTel = (phoneNumber: string) => {
    const hasPlus = phoneNumber.startsWith('+');
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    return hasPlus ? `+${digitsOnly}` : digitsOnly;
  };

  const handleCreateOrder = () => {
    router.push(`/create-order?customerId=${id}`);
  };

  return (
    <Card className="hover-elevate" data-testid={`card-recommendation-${id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-center gap-3 flex-1">
          <Avatar>
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(customerName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold text-base" data-testid="text-customer-name">{customerName}</h3>
            <p className="text-sm text-muted-foreground">{customerCompany}</p>
          </div>
        </div>
        <Badge className={priorityColors[priority]} variant="outline">
          {priorityLabels[priority]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-md bg-primary/5 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-foreground">{reasoning}</p>
        </div>

        <div className="overflow-hidden">
          <p className="text-xs font-medium text-muted-foreground mb-2">Preporučeni proizvodi:</p>
          <div className="flex flex-col gap-1">
            {suggestedProducts.map((product, idx) => (
              <Badge key={idx} variant="secondary" className="max-w-full justify-start overflow-hidden">
                <span className="truncate">{product}</span>
              </Badge>
            ))}
          </div>
        </div>

        {optimalTime && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Najbolje vrijeme: {optimalTime}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2 flex-wrap">
          <Button
            size="sm"
            variant="default"
            className="flex-1"
            data-testid="button-call-now"
            onClick={handleCallClick}
            disabled={!customerPhone || recordCallMutation.isPending}
          >
            <Phone className="h-3 w-3 mr-1" />
            Pozovi
          </Button>
          {customerEmail ? (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              data-testid="button-email"
              asChild
            >
              <a href={`mailto:${customerEmail}`}>
                <Mail className="h-3 w-3 mr-1" />
                Email
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              data-testid="button-email"
              disabled
            >
              <Mail className="h-3 w-3 mr-1" />
              Email
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            data-testid="button-create-order"
            onClick={handleCreateOrder}
          >
            <ShoppingCart className="h-3 w-3 mr-1" />
            Narudžba
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
