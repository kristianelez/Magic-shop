import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Pencil, Tag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { EditProductDialog } from "./EditProductDialog";
import { SetPromotionDialog } from "./SetPromotionDialog";
import { isPromotionActive, type Product } from "@shared/schema";
import { format } from "date-fns";

interface ProductCardProps {
  product: Product & { promoActive?: boolean };
}

export function ProductCard({ product }: ProductCardProps) {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const canEdit = user?.role !== "sales_manager";
  const canManagePromo = user?.role === "admin" || user?.role === "sales_director";

  const promoActive = product.promoActive ?? isPromotionActive(product);
  const regularPrice = parseFloat(product.price);
  const promoPrice = product.promoPrice ? parseFloat(product.promoPrice) : null;

  return (
    <>
      <Card className="hover-elevate" data-testid={`card-product-${product.id}`}>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-sm leading-tight line-clamp-2" data-testid="text-product-name">
                  {product.name}
                </h3>
                {promoActive && (
                  <Badge variant="destructive" className="text-[10px]" data-testid={`badge-promo-${product.id}`}>
                    AKCIJA
                  </Badge>
                )}
              </div>
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

          {promoActive && promoPrice !== null ? (
            <div className="space-y-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl font-bold text-destructive" data-testid={`text-promo-price-${product.id}`}>
                  {promoPrice.toFixed(2)} KM
                </span>
                <span className="text-sm text-muted-foreground line-through" data-testid={`text-regular-price-${product.id}`}>
                  {regularPrice.toFixed(2)} KM
                </span>
                <span className="text-sm text-muted-foreground">/ {product.unit}</span>
              </div>
              {product.promoEndDate && (
                <p className="text-[11px] text-muted-foreground" data-testid={`text-promo-end-${product.id}`}>
                  Akcija do {format(new Date(product.promoEndDate), "dd.MM.yyyy")}
                  {product.promoNote ? ` · ${product.promoNote}` : ""}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-primary">{regularPrice.toFixed(2)} KM</span>
              <span className="text-sm text-muted-foreground">/ {product.unit}</span>
            </div>
          )}

          {canManagePromo && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setPromoOpen(true)}
              data-testid={`button-set-promotion-${product.id}`}
            >
              <Tag className="h-4 w-4 mr-2" />
              {promoActive || product.promoPrice ? "Uredi akciju" : "Postavi akciju"}
            </Button>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <EditProductDialog product={product} open={editOpen} onOpenChange={setEditOpen} />
      )}
      {canManagePromo && (
        <SetPromotionDialog product={product} open={promoOpen} onOpenChange={setPromoOpen} />
      )}
    </>
  );
}
