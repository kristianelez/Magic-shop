import { StatsCard } from "@/components/StatsCard";
import { AIRecommendationCard } from "@/components/AIRecommendationCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Phone, Target, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  //todo: remove mock functionality
  const recentActivities = [
    { id: 1, customer: "Hotel Bristol", action: "Kupovina", product: "VORAX GT 5kg", time: "Prije 2h", amount: "450 KM" },
    { id: 2, customer: "Restoran Kod Muje", action: "Poziv", product: "Bacter WC 5L", time: "Prije 3h", amount: "-" },
    { id: 3, customer: "Bolnica Koševo", action: "Ponuda poslana", product: "Higi Glass Cleaner", time: "Prije 5h", amount: "890 KM" },
    { id: 4, customer: "Ćevabdžinica Željo", action: "Kupovina", product: "Higi Dish Soap", time: "Juče", amount: "120 KM" },
  ];

  const aiRecommendations = [
    {
      id: "1",
      customerName: "Amra Softić",
      customerCompany: "Hotel Bristol",
      suggestedProducts: ["VORAX GT 5kg", "Suma Grill D9"],
      reasoning: "Klijent redovno naručuje proizvode za čišćenje kuhinje svakih 30 dana. Vrijeme je za ponovno naručivanje.",
      priority: "high" as const,
      optimalTime: "10:00 - 12:00",
    },
    {
      id: "2",
      customerName: "Edin Jusić",
      customerCompany: "Bolnica Koševo",
      suggestedProducts: ["BACTER WC 5L", "WC Premium"],
      reasoning: "Prošlo je 25 dana od zadnje narudžbe toaletnih sredstava. Obično naručuju na 4 sedmice.",
      priority: "medium" as const,
      optimalTime: "14:00 - 16:00",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="heading-dashboard">Dashboard</h1>
        <p className="text-muted-foreground">Pregled vaših prodajnih aktivnosti</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Ukupno kupaca"
          value="142"
          icon={Users}
          trend={{ value: 12, isPositive: true }}
        />
        <StatsCard
          title="Pozivi danas"
          value="23"
          icon={Phone}
          description="od 30 planiranih"
        />
        <StatsCard
          title="Prodaja ovaj mjesec"
          value="45,290 KM"
          icon={TrendingUp}
          trend={{ value: 8, isPositive: true }}
        />
        <StatsCard
          title="Cilj mjeseca"
          value="78%"
          icon={Target}
          description="35,000 KM od 45,000 KM"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold mb-4">AI Preporuke za danas</h2>
          <div className="space-y-4">
            {aiRecommendations.map((rec) => (
              <AIRecommendationCard key={rec.id} {...rec} />
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Nedavne aktivnosti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start justify-between p-3 rounded-md hover-elevate border border-border"
                  data-testid={`activity-${activity.id}`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{activity.customer}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{activity.product}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="mb-1">
                      {activity.action}
                    </Badge>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                    {activity.amount !== "-" && (
                      <p className="text-xs font-semibold text-primary mt-0.5">{activity.amount}</p>
                    )}
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
