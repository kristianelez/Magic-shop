import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/StatsCard";
import { TrendingUp, DollarSign, ShoppingCart, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Sales() {
  //todo: remove mock functionality
  const recentSales = [
    { id: 1, customer: "Hotel Bristol", product: "VORAX GT 5kg x 10", amount: 899, date: "13 Nov 2025", status: "completed" },
    { id: 2, customer: "Bolnica Koševo", product: "BACTER WC 5L x 15", amount: 487.50, date: "12 Nov 2025", status: "completed" },
    { id: 3, customer: "Restoran Kod Muje", product: "Higi Dish Soap 4L x 8", amount: 231.20, date: "12 Nov 2025", status: "pending" },
    { id: 4, customer: "Tržni centar BBI", product: "Higi Glass Cleaner 4L x 20", amount: 498, date: "11 Nov 2025", status: "completed" },
    { id: 5, customer: "Hotel Bristol", product: "Suma Grill D9 2L x 6", amount: 270, date: "11 Nov 2025", status: "completed" },
    { id: 6, customer: "Ćevabdžinica Željo", product: "TASKI Jontec 300 5L x 4", amount: 270, date: "10 Nov 2025", status: "completed" },
  ];

  const topProducts = [
    { name: "VORAX GT 5kg", sold: 45, revenue: 4045.50 },
    { name: "BACTER WC 5L", sold: 38, revenue: 1235 },
    { name: "Higi Glass Cleaner 4L", sold: 52, revenue: 1294.80 },
    { name: "Suma Grill D9 2L", sold: 28, revenue: 1260 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="heading-sales">Prodaja</h1>
        <p className="text-muted-foreground">Pregled prodajnih rezultata</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Ukupna prodaja"
          value="45,290 KM"
          icon={DollarSign}
          trend={{ value: 8, isPositive: true }}
        />
        <StatsCard
          title="Broj transakcija"
          value="187"
          icon={ShoppingCart}
          trend={{ value: 12, isPositive: true }}
        />
        <StatsCard
          title="Prosječna vrijednost"
          value="242 KM"
          icon={TrendingUp}
          trend={{ value: 3, isPositive: false }}
        />
        <StatsCard
          title="Aktivni kupci"
          value="89"
          icon={Users}
          description="ovaj mjesec"
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
            <div className="space-y-4">
              {topProducts.map((product, idx) => (
                <div key={idx} className="space-y-2">
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
                      style={{ width: `${(product.sold / 52) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
