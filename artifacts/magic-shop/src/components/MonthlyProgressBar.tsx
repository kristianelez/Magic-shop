import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { format } from "date-fns";
import { bs } from "date-fns/locale";
import type { Sale } from "@workspace/db/schema";

const PDV_RATE = 0.17;
const MONTHLY_TARGET = 10000; // 10.000 KM bez PDV-a

export function MonthlyProgressBar() {
  const { data: sales = [] } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    staleTime: 30 * 60 * 1000,
  });

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const currentMonthName = format(now, "LLLL yyyy", { locale: bs });

  // Filter sales for current month
  const currentMonthSales = sales.filter((sale) =>
    isWithinInterval(new Date(sale.createdAt), { start: monthStart, end: monthEnd })
  );

  // Calculate total WITHOUT VAT (prices in DB include VAT)
  const totalWithVAT = currentMonthSales.reduce(
    (sum, sale) => sum + parseFloat(sale.totalAmount),
    0
  );
  const totalWithoutVAT = totalWithVAT / (1 + PDV_RATE);

  const percentage = Math.min((totalWithoutVAT / MONTHLY_TARGET) * 100, 100);
  const isComplete = percentage >= 100;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent" data-testid="monthly-progress-bar">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`p-1.5 rounded-md ${isComplete ? "bg-green-500/20" : "bg-primary/20"}`}>
                {isComplete ? (
                  <Target className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate capitalize">
                  {currentMonthName}
                </p>
                <p className="text-sm font-semibold truncate">
                  Mjesečni cilj
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-lg sm:text-xl font-bold ${isComplete ? "text-green-600" : "text-primary"}`}>
                {totalWithoutVAT.toFixed(0)} KM
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                od {MONTHLY_TARGET.toLocaleString()} KM
              </p>
            </div>
          </div>
          
          <div className="space-y-1">
            <Progress 
              value={percentage} 
              className={`h-2.5 ${isComplete ? "[&>div]:bg-green-500" : ""}`}
            />
            <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
              <span>{percentage.toFixed(0)}% ostvareno</span>
              <span className="text-muted-foreground/70">bez PDV-a</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
