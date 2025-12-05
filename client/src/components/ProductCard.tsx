import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface ProductCardProps {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
}

export function ProductCard({ id, name, category, price, stock, unit }: ProductCardProps) {
  const isLowStock = stock < 10;

  return (
    <Card className="hover-elevate" data-testid={`card-product-${id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3 min-w-0">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base font-semibold line-clamp-2 truncate" data-testid="text-product-name">
            {name}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1 truncate">{category}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-primary">{price} KM</span>
          <span className="text-sm text-muted-foreground">/{unit}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Na stanju:</span>
          <Badge variant={isLowStock ? "destructive" : "secondary"}>
            {stock} {unit}
          </Badge>
        </div>
        <Button size="sm" className="w-full" data-testid="button-add-product">
          <Plus className="h-4 w-4 mr-1" />
          Dodaj ponudi
        </Button>
      </CardContent>
    </Card>
  );
}
