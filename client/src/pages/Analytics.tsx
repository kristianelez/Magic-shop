import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/StatsCard";
import { AIRecommendationCard } from "@/components/AIRecommendationCard";
import { MonthlyProgressBar } from "@/components/MonthlyProgressBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Phone, Target, Clock, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, isWithinInterval, formatDistanceToNow } from "date-fns";
import { bs } from "date-fns/locale";
import type { Customer, Sale, Activity } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

interface CustomerWithStats extends Customer {
  totalPurchases: number;
  lastContact?: string;
  favoriteProducts: string[];
}

interface AIRecommendation {
  customerId: number;
  customerName: string;
  customerCompany: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  suggestedProducts: string[];
  reasoning: string;
  priority: "high" | "medium" | "low";
  optimalContactTime: string;
}

export default function Dashboard() {
  // Critical path - load these first
  const { data: customers = [], isLoading: customersLoading } = useQuery<CustomerWithStats[]>({
    queryKey: ["/api/customers"],
    staleTime: 30 * 60 * 1000,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
    staleTime: 30 * 60 * 1000,
  });

  // Secondary - load in background without blocking
  const { data: sales = [] } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    staleTime: 30 * 60 * 1000,
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    staleTime: 30 * 60 * 1000,
  });

  // Lazy load recommendations - don't block render
  const { data: aiRecommendations = [] } = useQuery<AIRecommendation[]>({
    queryKey: ["/api/recommendations"],
    staleTime: 30 * 60 * 1000,
  });

  // Only wait for critical data
  const isLoading = customersLoading || activitiesLoading;

  // Calculate current month's sales
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const currentMonthSales = (sales as Sale[]).filter(sale => 
    isWithinInterval(new Date(sale.createdAt), { start: monthStart, end: monthEnd })
  );
  const monthlyRevenue = currentMonthSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);

  // Get top products by quantity sold
  const productSalesMap = new Map<number, { name: string; quantity: number; revenue: number }>();
  currentMonthSales.forEach(sale => {
    const product = products.find((p: any) => p.id === sale.productId);
    if (product) {
      const existing = productSalesMap.get(sale.productId) || { name: product.name, quantity: 0, revenue: 0 };
      existing.quantity += sale.quantity;
      existing.revenue += parseFloat(sale.totalAmount);
      productSalesMap.set(sale.productId, existing);
    }
  });

  const topProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Get recent activities
  const recentActivitiesList = activities
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)
    .map(activity => {
      const customer = customers.find((c) => c.id === activity.customerId);
      const relatedSale = sales.find((s) => s.customerId === activity.customerId && 
        new Date(s.createdAt).toDateString() === new Date(activity.createdAt).toDateString());
      return {
        id: activity.id,
        customer: customer?.company || "Nepoznat kupac",
        action: activity.type === "call" ? "Poziv" : activity.type === "sale" ? "Kupovina" : "Aktivnost",
        product: relatedSale ? products.find((p: any) => p.id === relatedSale.productId)?.name : activity.notes || "-",
        time: formatDistanceToNow(new Date(activity.createdAt), { locale: bs, addSuffix: true }),
        amount: relatedSale ? `${parseFloat(relatedSale.totalAmount).toFixed(2)} KM` : "-",
      };
    });

  const todayCalls = activities.filter(activity => {
    const activityDate = new Date(activity.createdAt);
    return activityDate.toDateString() === new Date().toDateString() && activity.type === "call";
  }).length;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="heading-dashboard">Dashboard</h1>
        <p className="text-muted-foreground">Pregled vaših prodajnih aktivnosti</p>
      </div>

      <MonthlyProgressBar />

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Učitavanje...</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Ukupno kupaca"
              value={customers.length.toString()}
              icon={Users}
            />
            <StatsCard
              title="Pozivi danas"
              value={todayCalls.toString()}
              icon={Phone}
              description={`od ${activities.length} aktivnosti`}
            />
            <StatsCard
              title="Prodaja ovaj mjesec"
              value={`${monthlyRevenue.toFixed(0)} KM`}
              icon={TrendingUp}
            />
            <StatsCard
              title="Topproizvod"
              value={topProducts[0]?.name || "-"}
              icon={Package}
              description={topProducts[0] ? `${topProducts[0].quantity} kom` : "nema podataka"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Main content loads first */}
            <div>
              <h2 className="text-lg font-semibold mb-4">AI Preporuke</h2>
              <div className="space-y-4">
                {aiRecommendations.length > 0 ? (
                  aiRecommendations.slice(0, 3).map((rec, idx) => (
                    <AIRecommendationCard 
                      key={idx}
                      id={rec.customerId.toString()}
                      customerName={rec.customerName}
                      customerCompany={rec.customerCompany}
                      customerEmail={rec.customerEmail}
                      customerPhone={rec.customerPhone}
                      suggestedProducts={rec.suggestedProducts}
                      reasoning={rec.reasoning}
                      priority={rec.priority}
                      optimalTime={rec.optimalContactTime}
                    />
                  ))
                ) : (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      Nema preporuka u ovom trenutku
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4" />
                  Nedavne aktivnosti
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="space-y-2">
                  {recentActivitiesList.map((activity) => (
                    <div
                      key={activity.id}
                      className="p-2.5 rounded-md hover-elevate border border-border"
                      data-testid={`activity-${activity.id}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-medium text-sm truncate flex-1">{activity.customer}</p>
                        <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                          {activity.action}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{activity.product}</p>
                      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/50">
                        <span className="text-[10px] text-muted-foreground">{activity.time}</span>
                        {activity.amount !== "-" && (
                          <span className="text-xs font-semibold text-primary">{activity.amount}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {topProducts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  Top proizvodi ovaj mjesec
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="space-y-2">
                  {topProducts.map((product, idx) => (
                    <div 
                      key={idx} 
                      className="p-2.5 rounded-md border border-border hover-elevate"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/10 text-primary font-bold text-sm flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-muted-foreground">{product.quantity} kom</span>
                            <span className="text-sm font-semibold text-primary">{product.revenue.toFixed(0)} KM</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
