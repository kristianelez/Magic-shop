import { AIRecommendationCard } from "@/components/AIRecommendationCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, TrendingUp, Users, Clock } from "lucide-react";
import { StatsCard } from "@/components/StatsCard";
import { useQuery } from "@tanstack/react-query";

export default function AIRecommendations() {
  const { data: recommendations = [], isLoading } = useQuery({
    queryKey: ["/api/recommendations"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Generišem AI preporuke...</p>
      </div>
    );
  }

  const highPriorityCount = recommendations.filter((r: any) => r.priority === 'high').length;

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
          description={`${highPriorityCount} visokog prioriteta`}
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
          {recommendations.length > 0 ? (
            <div className="space-y-4">
              {recommendations.map((rec: any) => (
                <AIRecommendationCard 
                  key={rec.customerId} 
                  id={String(rec.customerId)}
                  customerName={rec.customerName}
                  customerCompany={rec.customerCompany}
                  suggestedProducts={rec.suggestedProducts}
                  reasoning={rec.reasoning}
                  priority={rec.priority}
                  optimalTime={rec.optimalContactTime}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Trenutno nema preporuka. AI će generisati preporuke kada kupci budu spremni za ponovno naručivanje.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
