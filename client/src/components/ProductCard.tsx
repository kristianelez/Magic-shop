import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Percent } from "lucide-react";

interface ProductCardProps {
  id: string;
  name: string;
  category: string;
  price: number;
  stock?: number;
  unit: string;
}

export function ProductCard({ id, name, category, price, unit }: ProductCardProps) {
  const discountTiers = [
    { minQty: 1, maxQty: 10, discount: 0 },
    { minQty: 11, maxQty: 50, discount: 5 },
    { minQty: 51, maxQty: 100, discount: 10 },
    { minQty: 101, maxQty: null, discount: 15 },
  ];

  return (
    <Card className="hover-elevate" data-testid={`card-product-${id}`}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight line-clamp-2" data-testid="text-product-name">
              {name}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 truncate">{category}</p>
          </div>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-primary">{price.toFixed(2)} KM</span>
          <span className="text-sm text-muted-foreground">/ {unit}</span>
        </div>

        <div className="pt-2 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium">Rabatna skala</span>
          </div>
          <div className="space-y-1.5">
            {discountTiers.map((tier, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {tier.maxQty ? `${tier.minQty}-${tier.maxQty} ${unit}` : `${tier.minQty}+ ${unit}`}
                </span>
                <Badge 
                  variant={tier.discount === 0 ? "outline" : "secondary"} 
                  className="text-xs"
                >
                  {tier.discount === 0 ? "Osnovna cijena" : `-${tier.discount}%`}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
