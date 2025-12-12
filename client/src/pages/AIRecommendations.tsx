import { AIRecommendationCard } from "@/components/AIRecommendationCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Users, Clock, AlertTriangle, Phone, Calendar, Building2 } from "lucide-react";
import { StatsCard } from "@/components/StatsCard";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays, format } from "date-fns";
import { bs } from "date-fns/locale";
import type { Customer, Activity } from "@shared/schema";

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

interface CustomerWithStats extends Customer {
  totalPurchases: number;
  lastContact?: string;
  favoriteProducts: string[];
}

interface CustomerAlarm {
  customer: CustomerWithStats;
  daysSinceContact: number;
  lastContactDate: Date | null;
}

export default function AIRecommendations() {
  const { data: recommendations = [], isLoading } = useQuery<Recommendation[]>({
    queryKey: ["/api/recommendations"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: customers = [] } = useQuery<CustomerWithStats[]>({
    queryKey: ["/api/customers"],
    staleTime: 30 * 60 * 1000,
  });

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
    staleTime: 30 * 60 * 1000,
  });

  const CONTACT_INTERVAL_DAYS = 10;

  const customerAlarms: CustomerAlarm[] = customers
    .filter(customer => customer.status === "active" || customer.status === "vip")
    .map(customer => {
      const customerActivities = activities
        .filter(a => a.customerId === customer.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const lastActivity = customerActivities[0];
      const lastContactDate = lastActivity ? new Date(lastActivity.createdAt) : null;
      const daysSinceContact = lastContactDate 
        ? differenceInDays(new Date(), lastContactDate)
        : 999;

      return {
        customer,
        daysSinceContact,
        lastContactDate,
      };
    })
    .filter(alarm => alarm.daysSinceContact >= CONTACT_INTERVAL_DAYS)
    .sort((a, b) => b.daysSinceContact - a.daysSinceContact);

  const highPriorityCount = recommendations.filter((r: any) => r.priority === 'high').length;
  const criticalAlarms = customerAlarms.filter(a => a.daysSinceContact >= 15).length;

  const getAlarmSeverity = (days: number) => {
    if (days >= 20) return { label: "Kritično", color: "bg-red-500 text-white", border: "border-red-500" };
    if (days >= 15) return { label: "Hitno", color: "bg-orange-500 text-white", border: "border-orange-400" };
    return { label: "Upozorenje", color: "bg-yellow-500 text-white", border: "border-yellow-400" };
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-ai-recommendations">
          <Sparkles className="h-6 w-6 text-primary" />
          Preporuke u prodaji
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
          title="Alarmi za poziv"
          value={customerAlarms.length}
          icon={AlertTriangle}
          description={criticalAlarms > 0 ? `${criticalAlarms} kritičnih` : "svi redovni"}
        />
        <StatsCard
          title="Kupci za kontakt"
          value={recommendations.length + customerAlarms.length}
          icon={Users}
          description="ukupno danas"
        />
      </div>

      {customerAlarms.length > 0 && (
        <Card className="border-2 border-orange-400/50 bg-orange-50/30 dark:bg-orange-900/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Alarmi - Kupci za poziv
              <Badge variant="destructive" className="ml-2">
                {customerAlarms.length}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Kupci koji nisu kontaktirani više od {CONTACT_INTERVAL_DAYS} dana
            </p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="space-y-3">
              {customerAlarms.map((alarm) => {
                const severity = getAlarmSeverity(alarm.daysSinceContact);
                return (
                  <div
                    key={alarm.customer.id}
                    className={`p-3 rounded-lg border-2 ${severity.border} bg-card hover-elevate`}
                    data-testid={`alarm-customer-${alarm.customer.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-semibold truncate">{alarm.customer.company}</span>
                          <Badge className={`${severity.color} text-[10px] flex-shrink-0`}>
                            {severity.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {alarm.customer.name}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          {alarm.customer.phone && (
                            <a 
                              href={`tel:${alarm.customer.phone}`}
                              className="flex items-center gap-1 text-sm text-primary hover:underline"
                              data-testid={`call-customer-${alarm.customer.id}`}
                            >
                              <Phone className="h-3 w-3" />
                              {alarm.customer.phone}
                            </a>
                          )}
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {alarm.lastContactDate 
                              ? format(alarm.lastContactDate, "d. MMM yyyy", { locale: bs })
                              : "Nikad kontaktiran"
                            }
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <div className="text-2xl font-bold text-orange-600">
                          {alarm.daysSinceContact === 999 ? "∞" : alarm.daysSinceContact}
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase">dana</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Prioritetna lista {isLoading && <span className="text-xs font-normal text-muted-foreground">(učitavanje...)</span>}
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
              <p className="text-muted-foreground">
                {isLoading 
                  ? "Generišem AI preporuke (može potrajati do 30 sekundi)..." 
                  : "Trenutno nema preporuka. AI će generisati preporuke kada kupci budu spremni za ponovno naručivanje."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
