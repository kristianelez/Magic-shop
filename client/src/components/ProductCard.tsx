import { Card, CardContent } from "@/components/ui/card";
import { Package } from "lucide-react";

interface ProductCardProps {
  id: string;
  name: string;
  category: string;
  price: number;
  stock?: number;
  unit: string;
}

export function ProductCard({ id, name, category, price, unit }: ProductCardProps) {
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
      </CardContent>
    </Card>
  );
}
