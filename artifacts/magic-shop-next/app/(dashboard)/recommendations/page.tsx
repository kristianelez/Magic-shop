"use client";

import { AIRecommendationCard } from "@/components/AIRecommendationCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Clock, TrendingUp, Package } from "lucide-react";
import { StatsCard } from "@/components/StatsCard";
import { useQuery } from "@tanstack/react-query";

interface Recommendation {
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

export default function AIRecommendations() {
  const { data: recommendations = [], isLoading } = useQuery<Recommendation[]>({
    queryKey: ["/api/recommendations"],
    staleTime: 5 * 60 * 1000,
  });

  const highPriorityCount = recommendations.filter((r: any) => r.priority === 'high').length;
  const mediumPriorityCount = recommendations.filter((r: any) => r.priority === 'medium').length;
  const lowPriorityCount = recommendations.filter((r: any) => r.priority === 'low').length;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-ai-recommendations">
          <Sparkles className="h-6 w-6 text-primary" />
          Preporuke u prodaji
        </h1>
        <p className="text-muted-foreground">
          Preporuke za artikle koje trebate ponuditi kupcima na osnovu njihovih kupovnih navika
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="Ukupno preporuka"
          value={recommendations.length}
          icon={Sparkles}
          description="kupaca za kontakt"
        />
        <StatsCard
          title="Visoki prioritet"
          value={highPriorityCount}
          icon={TrendingUp}
          description="hitne preporuke"
        />
        <StatsCard
          title="Srednji prioritet"
          value={mediumPriorityCount}
          icon={Clock}
          description="redovne preporuke"
        />
        <StatsCard
          title="Niski prioritet"
          value={lowPriorityCount}
          icon={Package}
          description="opcionalne preporuke"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Prioritetna lista preporuka
            {isLoading && <span className="text-xs font-normal text-muted-foreground">(učitavanje...)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Generišem preporuke (može potrajati do 30 sekundi)...
              </p>
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-4">
              {recommendations.map((rec: any) => (
                <AIRecommendationCard
                  key={rec.customerId}
                  id={String(rec.customerId)}
                  customerName={rec.customerName}
                  customerCompany={rec.customerCompany}
                  customerEmail={rec.customerEmail}
                  customerPhone={rec.customerPhone}
                  suggestedProducts={rec.suggestedProducts}
                  reasoning={rec.reasoning}
                  priority={rec.priority}
                  optimalTime={rec.optimalContactTime}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nema preporuka</h3>
              <p className="text-muted-foreground">
                Sistem će generisati preporuke kada kupci budu spremni za ponovno naručivanje na osnovu njihovih kupovnih obrazaca.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
