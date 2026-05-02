import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Phone, Calendar, Building2, Users, Bell, CheckCircle } from "lucide-react";
import { StatsCard } from "@/components/StatsCard";
import { useQuery, useMutation } from "@tanstack/react-query";
import { differenceInDays, format } from "date-fns";
import { bs } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
        queryClient.refetchQueries({ queryKey: ['/api/customers'] }),
        queryClient.refetchQueries({ queryKey: ['/api/activities'] }),
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

  const criticalAlarms = customerAlarms.filter(a => a.daysSinceContact >= 20).length;
  const urgentAlarms = customerAlarms.filter(a => a.daysSinceContact >= 15 && a.daysSinceContact < 20).length;
  const warningAlarms = customerAlarms.filter(a => a.daysSinceContact >= 10 && a.daysSinceContact < 15).length;

  const getAlarmSeverity = (days: number) => {
    if (days >= 20) return { label: "Kritično", color: "bg-red-500 text-white", border: "border-red-500" };
    if (days >= 15) return { label: "Hitno", color: "bg-orange-500 text-white", border: "border-orange-400" };
    return { label: "Upozorenje", color: "bg-yellow-500 text-white", border: "border-yellow-400" };
  };

  const handleCallCustomer = async (customer: CustomerWithStats) => {
    if (customer.phone) {
      try {
        await recordCallMutation.mutateAsync(customer.id);
        const telLink = document.createElement('a');
        telLink.href = `tel:${customer.phone.replace(/\D/g, '')}`;
        telLink.click();
      } catch (error) {
        const telLink = document.createElement('a');
        telLink.href = `tel:${customer.phone.replace(/\D/g, '')}`;
        telLink.click();
      }
    }
  };

  const isLoading = customersLoading || activitiesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Učitavam podatke o kupcima...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-customer-contacts">
          <Bell className="h-6 w-6 text-orange-500" />
          Kontaktiranje kupaca
        </h1>
        <p className="text-muted-foreground">
          Praćenje kontakata sa kupcima i alarmi za redovno javljanje
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="Ukupno alarma"
          value={customerAlarms.length}
          icon={AlertTriangle}
          description="kupaca za kontakt"
        />
        <StatsCard
          title="Kritični"
          value={criticalAlarms}
          icon={AlertTriangle}
          description="20+ dana bez kontakta"
        />
        <StatsCard
          title="Hitni"
          value={urgentAlarms}
          icon={Phone}
          description="15-19 dana bez kontakta"
        />
        <StatsCard
          title="Upozorenja"
          value={warningAlarms}
          icon={Bell}
          description="10-14 dana bez kontakta"
        />
      </div>

      {customerAlarms.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Svi kupci su kontaktirani</h3>
              <p className="text-muted-foreground">
                Nema kupaca koji čekaju kontakt duže od {CONTACT_INTERVAL_DAYS} dana.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-orange-400/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Alarmi - Kupci za poziv
              <Badge variant="destructive" className="ml-2">
                {customerAlarms.length}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Kupci koji nisu kontaktirani više od {CONTACT_INTERVAL_DAYS} dana. 
              Kliknite na dugme "Pozovi" da evidentirate kontakt i pozovete kupca.
            </p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="space-y-3">
              {customerAlarms.map((alarm) => {
                const severity = getAlarmSeverity(alarm.daysSinceContact);
                return (
                  <div
                    key={alarm.customer.id}
                    className={`p-4 rounded-lg border-2 ${severity.border} bg-card hover-elevate`}
                    data-testid={`alarm-customer-${alarm.customer.id}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-semibold truncate">{alarm.customer.company}</span>
                          <Badge className={`${severity.color} text-[10px] flex-shrink-0`}>
                            {severity.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground truncate">
                            {alarm.customer.name}
                          </p>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3">
                          {alarm.customer.phone && (
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {alarm.customer.phone}
                            </span>
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
                      
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {alarm.daysSinceContact === 999 ? "∞" : alarm.daysSinceContact}
                          </div>
                          <p className="text-[10px] text-muted-foreground uppercase">dana</p>
                        </div>
                        
                        {alarm.customer.phone && (
                          <Button
                            size="sm"
                            onClick={() => handleCallCustomer(alarm.customer)}
                            disabled={recordCallMutation.isPending}
                            data-testid={`call-customer-${alarm.customer.id}`}
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Pozovi
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
