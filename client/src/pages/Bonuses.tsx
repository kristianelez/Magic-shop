import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Target, TrendingUp, Zap, Crown, Flame, Award, ChevronRight } from "lucide-react";
import { startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import type { Sale } from "@shared/schema";

const bonusTiers = [
  { threshold: 5000, bonus: 50, label: "Starter", icon: Star, color: "from-slate-400 to-slate-500" },
  { threshold: 8000, bonus: 100, label: "Bronze", icon: Award, color: "from-amber-600 to-amber-700" },
  { threshold: 10000, bonus: 200, label: "Silver", icon: Target, color: "from-gray-400 to-gray-500" },
  { threshold: 15000, bonus: 350, label: "Gold", icon: Trophy, color: "from-yellow-400 to-yellow-500" },
  { threshold: 20000, bonus: 500, label: "Platinum", icon: Crown, color: "from-purple-400 to-purple-600" },
  { threshold: 30000, bonus: 800, label: "Diamond", icon: Flame, color: "from-cyan-400 to-blue-500" },
];

export default function Bonuses() {
  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    staleTime: 30 * 60 * 1000,
  });

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  
  const currentMonthSales = sales.filter(sale => 
    isWithinInterval(new Date(sale.createdAt), { start: monthStart, end: monthEnd })
  );
  
  const monthlyRevenue = currentMonthSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
  const revenueWithoutVAT = monthlyRevenue / 1.17;

  const currentTier = bonusTiers.filter(tier => revenueWithoutVAT >= tier.threshold).pop();
  const nextTier = bonusTiers.find(tier => revenueWithoutVAT < tier.threshold);
  
  const currentBonus = currentTier?.bonus || 0;
  const progressToNext = nextTier 
    ? ((revenueWithoutVAT / nextTier.threshold) * 100)
    : 100;
  const amountToNext = nextTier 
    ? (nextTier.threshold - revenueWithoutVAT)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Učitavanje...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-bonuses">
          <Trophy className="h-6 w-6 text-yellow-500" />
          Bonus Program
        </h1>
        <p className="text-muted-foreground">
          Ostvari veći promet i osvoji bonus na platu!
        </p>
      </div>

      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Zap className="h-8 w-8 text-yellow-500 animate-pulse" />
              <span className="text-lg font-medium text-muted-foreground">Tvoj promet ovog mjeseca</span>
            </div>
            <div className="text-5xl font-bold text-primary" data-testid="text-monthly-revenue">
              {revenueWithoutVAT.toFixed(0)} KM
            </div>
            <p className="text-sm text-muted-foreground">(bez PDV-a)</p>
            
            {currentTier && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Badge className={`bg-gradient-to-r ${currentTier.color} text-white border-0 text-base px-4 py-1`}>
                  <currentTier.icon className="h-4 w-4 mr-2" />
                  {currentTier.label} nivo
                </Badge>
              </div>
            )}
            
            <div className="pt-4 pb-2">
              <div className="text-3xl font-bold text-green-600" data-testid="text-current-bonus">
                +{currentBonus} KM
              </div>
              <p className="text-sm text-muted-foreground">Tvoj trenutni bonus</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {nextTier && (
        <Card className="border-dashed border-2 border-yellow-400/50 bg-yellow-50/30 dark:bg-yellow-900/10">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-yellow-600" />
                  <span className="font-medium">Do sljedećeg nivoa</span>
                </div>
                <Badge variant="outline" className="text-yellow-600 border-yellow-400">
                  <nextTier.icon className="h-3 w-3 mr-1" />
                  {nextTier.label}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{revenueWithoutVAT.toFixed(0)} KM</span>
                  <span className="font-medium">{nextTier.threshold.toLocaleString()} KM</span>
                </div>
                <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${nextTier.color} transition-all duration-1000 ease-out`}
                    style={{ width: `${Math.min(progressToNext, 100)}%` }}
                  />
                </div>
              </div>
              
              <div className="text-center pt-2">
                <p className="text-lg">
                  Još samo <span className="font-bold text-primary">{amountToNext.toFixed(0)} KM</span> do 
                  <span className="font-bold text-green-600"> +{nextTier.bonus} KM</span> bonusa!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          Bonus skala
        </h2>
        <div className="space-y-3">
          {bonusTiers.map((tier, idx) => {
            const isAchieved = revenueWithoutVAT >= tier.threshold;
            const isCurrent = currentTier?.threshold === tier.threshold;
            const TierIcon = tier.icon;
            
            return (
              <Card 
                key={tier.threshold}
                className={`transition-all duration-300 ${
                  isCurrent 
                    ? 'ring-2 ring-primary ring-offset-2 shadow-lg' 
                    : isAchieved 
                      ? 'bg-green-50/50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                      : 'opacity-70'
                }`}
                data-testid={`tier-${tier.threshold}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br ${tier.color} ${isAchieved ? '' : 'grayscale opacity-50'}`}>
                      <TierIcon className="h-6 w-6 text-white" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{tier.label}</span>
                        {isCurrent && (
                          <Badge variant="default" className="text-[10px]">TRENUTNO</Badge>
                        )}
                        {isAchieved && !isCurrent && (
                          <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">OSTVARENO</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Promet: {tier.threshold.toLocaleString()} KM
                      </p>
                    </div>
                    
                    <div className="text-right flex-shrink-0">
                      <div className={`text-xl font-bold ${isAchieved ? 'text-green-600' : 'text-muted-foreground'}`}>
                        +{tier.bonus} KM
                      </div>
                      <p className="text-xs text-muted-foreground">bonus</p>
                    </div>
                    
                    {!isAchieved && (
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Flame className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Motivacija</h3>
              <p className="text-muted-foreground">
                Svaki poziv te približava cilju! Fokusiraj se na kupce sa najvećim potencijalom 
                i koristi preporuke u prodaji za maksimalan učinak. Ti to možeš! 💪
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
