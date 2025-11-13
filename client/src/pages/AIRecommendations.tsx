import { AIRecommendationCard } from "@/components/AIRecommendationCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, TrendingUp, Users, Clock } from "lucide-react";
import { StatsCard } from "@/components/StatsCard";

export default function AIRecommendations() {
  //todo: remove mock functionality
  const recommendations = [
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
    {
      id: "3",
      customerName: "Haris Begić",
      customerCompany: "Tržni centar BBI",
      suggestedProducts: ["Higi Glass Cleaner 4L", "TASKI Jontec 300 5L"],
      reasoning: "VIP klijent koji preferira bulk narudžbe. Pokazuje interes za nove proizvode za održavanje.",
      priority: "high" as const,
      optimalTime: "09:00 - 11:00",
    },
    {
      id: "4",
      customerName: "Selma Imamović",
      customerCompany: "Restoran Kod Muje",
      suggestedProducts: ["Higi Dish Soap 4L", "Domestos gel"],
      reasoning: "Redovan klijent sa predvidivim ciklusom naručivanja. Vrijeme za obnovu zaliha.",
      priority: "medium" as const,
      optimalTime: "13:00 - 15:00",
    },
    {
      id: "5",
      customerName: "Lejla Karić",
      customerCompany: "Škola Štampar Makarije",
      suggestedProducts: ["TASKI Jontec 300 5L", "Higi Glass Cleaner"],
      reasoning: "Nije naručivao već 3 sedmice. Možda je vrijeme za reaktivaciju sa specijalnom ponudom.",
      priority: "low" as const,
      optimalTime: "11:00 - 13:00",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-ai-recommendations">
          <Sparkles className="h-6 w-6 text-primary" />
          AI Preporuke
        </h1>
        <p className="text-muted-foreground">
          Pametne preporuke za kontakte sa kupcima baziran na njihovim kupovnim navikama
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Preporuke danas"
          value={recommendations.length}
          icon={Sparkles}
          description={`${recommendations.filter(r => r.priority === 'high').length} visokog prioriteta`}
        />
        <StatsCard
          title="Očekivana prodaja"
          value="12,400 KM"
          icon={TrendingUp}
          description="na osnovu preporuka"
        />
        <StatsCard
          title="Kupci za kontakt"
          value={recommendations.length}
          icon={Users}
          description="optimalno vrijeme prikazano"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Prioritetna lista
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <AIRecommendationCard key={rec.id} {...rec} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
