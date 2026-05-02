import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { EditProductDialog } from "./EditProductDialog";
import type { Product } from "@shared/schema";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const canEdit = user?.role !== "sales_manager";

  const price = parseFloat(product.price);

  return (
    <>
      <Card className="hover-elevate" data-testid={`card-product-${product.id}`}>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-tight line-clamp-2" data-testid="text-product-name">
                {product.name}
              </h3>
              <div className="flex flex-col gap-0.5 mt-1">
                <p className="text-[10px] text-muted-foreground font-mono">
                  Šifra: {product.vendor || "N/A"} | Barkod: {product.barcode || "N/A"}
                </p>
                <p className="text-xs text-muted-foreground truncate">{product.category}</p>
              </div>
            </div>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditOpen(true)}
                data-testid={`button-edit-product-${product.id}`}
                aria-label="Izmijeni artikal"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-primary">{price.toFixed(2)} KM</span>
            <span className="text-sm text-muted-foreground">/ {product.unit}</span>
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <EditProductDialog product={product} open={editOpen} onOpenChange={setEditOpen} />
      )}
    </>
  );
}
