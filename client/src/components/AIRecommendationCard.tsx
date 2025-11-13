import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Phone, Clock } from "lucide-react";

interface AIRecommendationCardProps {
  id: string;
  customerName: string;
  customerCompany: string;
  suggestedProducts: string[];
  reasoning: string;
  priority: "high" | "medium" | "low";
  optimalTime?: string;
}

export function AIRecommendationCard({
  id,
  customerName,
  customerCompany,
  suggestedProducts,
  reasoning,
  priority,
  optimalTime,
}: AIRecommendationCardProps) {
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
        
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Preporučeni proizvodi:</p>
          <div className="flex flex-wrap gap-1">
            {suggestedProducts.map((product, idx) => (
              <Badge key={idx} variant="secondary">
                {product}
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

        <div className="flex gap-2 pt-2">
          <Button size="sm" className="flex-1" data-testid="button-call-now">
            <Phone className="h-3 w-3 mr-1" />
            Pozovi sada
          </Button>
          <Button size="sm" variant="outline" data-testid="button-schedule">
            Zakaži
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
