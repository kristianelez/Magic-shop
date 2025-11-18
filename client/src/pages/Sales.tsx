import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/StatsCard";
import { TrendingUp, DollarSign, ShoppingCart, Users, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { bs } from "date-fns/locale";
import type { Sale, Customer, Product } from "@shared/schema";

export default function Sales() {
  const [, setLocation] = useLocation();

  const { data: sales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const isLoading = salesLoading || customersLoading || productsLoading;

  // Nedavne prodaje (zadnjih 10)
  const recentSales = sales.slice(0, 10).map((sale) => {
    const customer = customers.find((c) => c.id === sale.customerId);
    const product = products.find((p) => p.id === sale.productId);
    return {
      id: sale.id,
      customer: customer?.name || "N/A",
      product: `${product?.name || "N/A"} x ${sale.quantity}`,
      amount: parseFloat(sale.totalAmount),
      date: format(new Date(sale.createdAt), "dd MMM yyyy", { locale: bs }),
      status: sale.status,
    };
  });

  // Izračunaj statistike
  const totalSales = sales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
  const totalTransactions = sales.length;
  const averageValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;
  
  // Broj jedinstvenih kupaca
  const uniqueCustomers = new Set(sales.map((s) => s.customerId)).size;

  // Top proizvodi
  const productStats: { [key: number]: { name: string; sold: number; revenue: number } } = {};
  
  sales.forEach((sale) => {
    const product = products.find((p) => p.id === sale.productId);
    if (product) {
      if (!productStats[product.id]) {
        productStats[product.id] = {
          name: product.name,
          sold: 0,
          revenue: 0,
        };
      }
      productStats[product.id].sold += sale.quantity;
      productStats[product.id].revenue += parseFloat(sale.totalAmount);
    }
  });

  const topProducts = Object.values(productStats)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 4);

  const maxSold = Math.max(...topProducts.map((p) => p.sold), 1);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Učitavam podatke...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-sales">Prodaja</h1>
          <p className="text-muted-foreground">Pregled prodajnih rezultata</p>
        </div>
        <Button 
          onClick={() => setLocation("/orders")} 
          variant="outline"
          data-testid="button-view-orders"
        >
          <ClipboardList className="h-4 w-4 mr-2" />
          Pregled narudžbi
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Ukupna prodaja"
          value={`${totalSales.toFixed(2)} KM`}
          icon={DollarSign}
        />
        <StatsCard
          title="Broj transakcija"
          value={String(totalTransactions)}
          icon={ShoppingCart}
        />
        <StatsCard
          title="Prosječna vrijednost"
          value={`${averageValue.toFixed(2)} KM`}
          icon={TrendingUp}
        />
        <StatsCard
          title="Aktivni kupci"
          value={String(uniqueCustomers)}
          icon={Users}
          description="ukupno"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nedavne prodaje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border hover-elevate"
                  data-testid={`sale-${sale.id}`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{sale.customer}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{sale.product}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{sale.date}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className="font-semibold text-primary">{sale.amount.toFixed(2)} KM</p>
                    <Badge variant={sale.status === "completed" ? "secondary" : "outline"}>
                      {sale.status === "completed" ? "Završeno" : "Na čekanju"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top proizvodi</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nema podataka o prodaji proizvoda.
              </p>
            ) : (
              <div className="space-y-4">
                {topProducts.map((product, idx) => (
                  <div key={idx} className="space-y-2" data-testid={`top-product-${idx}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{product.name}</span>
                      <span className="text-sm font-semibold text-primary">
                        {product.revenue.toFixed(2)} KM
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{product.sold} prodatih jedinica</span>
                      <span>#{idx + 1}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${(product.sold / maxSold) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
