import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { StatsCard } from "@/components/StatsCard";
import { MonthlyProgressBar } from "@/components/MonthlyProgressBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Phone, Clock, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { startOfMonth, endOfMonth, isWithinInterval, formatDistanceToNow } from "date-fns";
import { bs } from "date-fns/locale";
import type { Customer, Sale, Activity } from "@shared/schema";

interface CustomerWithStats extends Customer {
  totalPurchases: number;
  lastContact?: string;
  favoriteProducts: string[];
}

export default function Dashboard() {
  const [recsEnabled, setRecsEnabled] = useState(false);

  // Enable recommendations query after initial render is complete
  useEffect(() => {
    const timer = setTimeout(() => setRecsEnabled(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const { data: customers = [], isLoading: customersLoading } = useQuery<CustomerWithStats[]>({
    queryKey: ["/api/customers"],
    staleTime: 30 * 60 * 1000,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
    staleTime: 30 * 60 * 1000,
  });

  const { data: sales = [] } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    staleTime: 30 * 60 * 1000,
  });

  // Deferred — only starts after initial render, pre-warms cache for recommendations page
  useQuery({
    queryKey: ["/api/recommendations"],
    staleTime: 30 * 60 * 1000,
    enabled: recsEnabled,
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

  // Count unique products sold this month (no product catalog needed)
  const uniqueProductsSold = new Set(currentMonthSales.map(s => s.productId)).size;

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
        notes: activity.notes || "-",
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
        <h1 className="text-2xl font-semibold" data-testid="heading-dashboard">Analitika</h1>
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
              title="Artikala prodano"
              value={uniqueProductsSold.toString()}
              icon={Package}
              description="različitih artikala ovaj mjesec"
            />
          </div>

          <div className="grid gap-6">
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
                      <p className="text-xs text-muted-foreground truncate">{activity.notes}</p>
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
        </>
      )}
    </div>
  );
}
