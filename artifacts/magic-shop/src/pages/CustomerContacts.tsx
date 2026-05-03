import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Phone,
  Calendar,
  Building2,
  Users,
  Bell,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { differenceInDays, format } from "date-fns";
import { bs } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Customer, Activity } from "@workspace/db/schema";

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

type SeverityKey = "critical" | "urgent" | "warning";

interface SeverityStyle {
  key: SeverityKey;
  label: string;
  badgeClass: string;
  borderClass: string;
  ringClass: string;
  numberClass: string;
  glowClass: string;
}

const SEVERITY: Record<SeverityKey, SeverityStyle> = {
  critical: {
    key: "critical",
    label: "Kritično",
    badgeClass: "bg-red-600 text-white border-red-700",
    borderClass: "border-l-red-500",
    ringClass: "ring-red-500/20",
    numberClass: "text-red-500",
    glowClass: "bg-red-500/10",
  },
  urgent: {
    key: "urgent",
    label: "Hitno",
    badgeClass: "bg-orange-500 text-white border-orange-600",
    borderClass: "border-l-orange-500",
    ringClass: "ring-orange-500/20",
    numberClass: "text-orange-500",
    glowClass: "bg-orange-500/10",
  },
  warning: {
    key: "warning",
    label: "Upozorenje",
    badgeClass: "bg-amber-500 text-white border-amber-600",
    borderClass: "border-l-amber-500",
    ringClass: "ring-amber-500/20",
    numberClass: "text-amber-500",
    glowClass: "bg-amber-500/10",
  },
};

function getSeverity(days: number): SeverityStyle {
  if (days >= 20) return SEVERITY.critical;
  if (days >= 15) return SEVERITY.urgent;
  return SEVERITY.warning;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

interface SummaryCardProps {
  label: string;
  value: number;
  hint: string;
  icon: typeof Bell;
  tone: "brand" | "critical" | "urgent" | "warning";
}

function SummaryCard({ label, value, hint, icon: Icon, tone }: SummaryCardProps) {
  const toneClasses = {
    brand: {
      iconWrap: "bg-primary/15 text-primary ring-1 ring-primary/30",
      number: "text-foreground",
      accent: "from-primary/40 to-transparent",
    },
    critical: {
      iconWrap: "bg-red-500/15 text-red-500 ring-1 ring-red-500/30",
      number: "text-red-500",
      accent: "from-red-500/50 to-transparent",
    },
    urgent: {
      iconWrap: "bg-orange-500/15 text-orange-500 ring-1 ring-orange-500/30",
      number: "text-orange-500",
      accent: "from-orange-500/50 to-transparent",
    },
    warning: {
      iconWrap: "bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30",
      number: "text-amber-500",
      accent: "from-amber-500/50 to-transparent",
    },
  }[tone];

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm hover-elevate transition-shadow">
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", toneClasses.accent)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </p>
          <p className={cn("text-3xl font-bold tabular-nums mt-1.5", toneClasses.number)}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg shrink-0", toneClasses.iconWrap)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function CustomerContacts() {
  const { toast } = useToast();

  const { data: customers = [], isLoading: customersLoading } = useQuery<CustomerWithStats[]>({
    queryKey: ["/api/customers"],
    staleTime: 30 * 60 * 1000,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
    staleTime: 30 * 60 * 1000,
  });

  const recordCallMutation = useMutation({
    mutationFn: async (customerId: number) => {
      return await apiRequest("POST", `/api/activities/call/${customerId}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/customers"] }),
        queryClient.refetchQueries({ queryKey: ["/api/activities"] }),
      ]);
      toast({
        title: "Poziv evidentiran",
        description: "Kontakt sa kupcem je uspješno zabilježen",
      });
    },
    onError: () => {
      toast({
        title: "Greška",
        description: "Nije moguće evidentirati poziv",
        variant: "destructive",
      });
    },
  });

  const CONTACT_INTERVAL_DAYS = 10;

  const customerAlarms: CustomerAlarm[] = customers
    .filter((customer) => customer.status === "active" || customer.status === "vip")
    .map((customer) => {
      const customerActivities = activities
        .filter((a) => a.customerId === customer.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const lastActivity = customerActivities[0];
      const lastContactDate = lastActivity ? new Date(lastActivity.createdAt) : null;
      const daysSinceContact = lastContactDate
        ? differenceInDays(new Date(), lastContactDate)
        : 999;

      return { customer, daysSinceContact, lastContactDate };
    })
    .filter((alarm) => alarm.daysSinceContact >= CONTACT_INTERVAL_DAYS)
    .sort((a, b) => b.daysSinceContact - a.daysSinceContact);

  const criticalAlarms = customerAlarms.filter((a) => a.daysSinceContact >= 20).length;
  const urgentAlarms = customerAlarms.filter(
    (a) => a.daysSinceContact >= 15 && a.daysSinceContact < 20,
  ).length;
  const warningAlarms = customerAlarms.filter(
    (a) => a.daysSinceContact >= 10 && a.daysSinceContact < 15,
  ).length;

  const handleCallCustomer = async (customer: CustomerWithStats) => {
    if (!customer.phone) return;
    try {
      await recordCallMutation.mutateAsync(customer.id);
    } catch {
      // Even if logging fails, still let the user place the call.
    }
    const telLink = document.createElement("a");
    telLink.href = `tel:${customer.phone.replace(/\D/g, "")}`;
    telLink.click();
  };

  const isLoading = customersLoading || activitiesLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Učitavam podatke o kupcima...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Page header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/30 shadow-sm">
            <Bell className="h-7 w-7 text-primary" />
          </div>
          <div className="min-w-0">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight text-foreground"
              data-testid="heading-customer-contacts"
            >
              Kontaktiranje kupaca
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Praćenje kontakata sa kupcima i alarmi za redovno javljanje
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Ukupno alarma"
          value={customerAlarms.length}
          hint="kupaca za kontakt"
          icon={Bell}
          tone="brand"
        />
        <SummaryCard
          label="Kritični"
          value={criticalAlarms}
          hint="20+ dana bez kontakta"
          icon={AlertTriangle}
          tone="critical"
        />
        <SummaryCard
          label="Hitni"
          value={urgentAlarms}
          hint="15–19 dana bez kontakta"
          icon={Phone}
          tone="urgent"
        />
        <SummaryCard
          label="Upozorenja"
          value={warningAlarms}
          hint="10–14 dana bez kontakta"
          icon={Clock}
          tone="warning"
        />
      </div>

      {customerAlarms.length === 0 ? (
        <Card className="border-emerald-500/30 bg-gradient-to-br from-card to-emerald-500/5">
          <CardContent className="pt-10 pb-10">
            <div className="flex flex-col items-center text-center gap-3 max-w-md mx-auto">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="h-9 w-9 text-emerald-500" />
              </div>
              <h3 className="text-xl font-semibold">Svi kupci su kontaktirani</h3>
              <p className="text-sm text-muted-foreground">
                Nema kupaca koji čekaju kontakt duže od {CONTACT_INTERVAL_DAYS} dana. Svaka čast!
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {/* List header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-b border-border bg-gradient-to-r from-card to-primary/5">
            <div className="flex items-center gap-3 min-w-0">
              <AlertTriangle className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <h2 className="font-semibold text-foreground">Kupci za poziv</h2>
                <p className="text-xs text-muted-foreground">
                  Nisu kontaktirani više od {CONTACT_INTERVAL_DAYS} dana — kliknite "Pozovi" da
                  evidentirate kontakt.
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="self-start sm:self-auto bg-primary/15 text-primary border-primary/30 px-3 py-1 text-sm font-semibold">
              {customerAlarms.length} {customerAlarms.length === 1 ? "kupac" : "kupaca"}
            </Badge>
          </div>

          <ul className="divide-y divide-border">
            {customerAlarms.map((alarm) => {
              const severity = getSeverity(alarm.daysSinceContact);
              const displayDays = alarm.daysSinceContact === 999 ? "∞" : alarm.daysSinceContact;
              return (
                <li
                  key={alarm.customer.id}
                  className={cn(
                    "relative flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 border-l-4 transition-colors hover-elevate",
                    severity.borderClass,
                  )}
                  data-testid={`alarm-customer-${alarm.customer.id}`}
                >
                  {/* Avatar */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-semibold text-sm ring-2",
                        severity.glowClass,
                        severity.numberClass,
                        severity.ringClass,
                      )}
                    >
                      {getInitials(alarm.customer.company || alarm.customer.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-foreground truncate">
                          {alarm.customer.company}
                        </span>
                        <Badge
                          className={cn(
                            "text-[10px] uppercase tracking-wide px-2 py-0 h-5 border",
                            severity.badgeClass,
                          )}
                        >
                          {severity.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{alarm.customer.name}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        {alarm.customer.phone && (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" />
                            <span className="tabular-nums">{alarm.customer.phone}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {alarm.lastContactDate
                            ? `Posljednji kontakt: ${format(alarm.lastContactDate, "d. MMM yyyy", { locale: bs })}`
                            : "Nikad kontaktiran"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right cluster: days + call button */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-5 sm:pl-4 sm:border-l sm:border-border sm:ml-2">
                    <div className="text-center min-w-[64px]">
                      <div
                        className={cn(
                          "text-3xl font-bold tabular-nums leading-none",
                          severity.numberClass,
                        )}
                      >
                        {displayDays}
                      </div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                        dana
                      </p>
                    </div>

                    {alarm.customer.phone && (
                      <Button
                        size="sm"
                        onClick={() => handleCallCustomer(alarm.customer)}
                        disabled={recordCallMutation.isPending}
                        data-testid={`call-customer-${alarm.customer.id}`}
                        className="shadow-sm"
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        Pozovi
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
