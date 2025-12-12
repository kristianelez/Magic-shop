import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import type { Product } from "@shared/schema";

export default function Products() {
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Učitavam proizvode...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold">Proizvodi</h1>
        <p className="text-muted-foreground">Katalog dostupnih proizvoda</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} className="hover-elevate">
            <CardHeader className="pb-3">
              <CardTitle className="text-base truncate">{product.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cijena:</span>
                  <span className="font-semibold text-primary">{parseFloat(product.price).toFixed(2)} KM</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Kategorija:</span>
                  <span className="text-sm truncate">{product.category}</span>
                </div>
                {product.stock !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Stanje:</span>
                    <span className="text-sm">{product.stock} kom</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {products.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">Nema dostupnih proizvoda</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
