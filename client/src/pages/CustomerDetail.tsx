import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Mail, Calendar, MessageSquare, Plus } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { bs } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Activity } from "@shared/schema";

interface CustomerWithStats extends Customer {
  totalPurchases: number;
  lastContact?: string;
  favoriteProducts: string[];
}

export default function CustomerDetail() {
  const { customerId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [newActivityNotes, setNewActivityNotes] = useState("");
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
  const [editingActivityNotes, setEditingActivityNotes] = useState("");

  const { data: customer } = useQuery<CustomerWithStats>({
    queryKey: ["/api/customers", customerId],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customerId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch customer");
      return res.json();
    },
  });

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
    queryFn: async () => {
      const res = await fetch("/api/activities", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
  });

  const addActivityMutation = useMutation({
    mutationFn: async (notes: string) => {
      return await apiRequest("POST", "/api/activities", {
        customerId: parseInt(customerId!),
        type: "note",
        notes: notes,
      });
    },
    onSuccess: () => {
      toast({
        title: "Uspješno",
        description: "Beleška je dodana",
      });
      setNewActivityNotes("");
      setShowAddActivity(false);
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
    onError: () => {
      toast({
        title: "Greška",
        description: "Nije moguće dodati belesku",
        variant: "destructive",
      });
    },
  });

  const editActivityMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      return await apiRequest("PATCH", `/api/activities/${id}`, {
        notes: notes,
      });
    },
    onSuccess: () => {
      toast({
        title: "Uspješno",
        description: "Beleška je ažurirana",
      });
      setEditingActivityId(null);
      setEditingActivityNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
    onError: () => {
      toast({
        title: "Greška",
        description: "Nije moguće ažurirati belesku",
        variant: "destructive",
      });
    },
  });

  const customerActivities = (activities as Activity[])
    .filter(a => a.customerId === parseInt(customerId!))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const activityTypeLabels: Record<string, string> = {
    call: "Poziv",
    note: "Beleška",
    sale: "Kupovina",
    meeting: "Sastanak",
  };

  const activityTypeIcons: Record<string, any> = {
    call: Phone,
    note: MessageSquare,
    sale: MessageSquare,
    meeting: Calendar,
  };

  if (!customer) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Učitavam...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/customers")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-customer-detail">{customer.name}</h1>
          <p className="text-muted-foreground">{customer.company}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informacije</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge>{customer.status === "active" ? "Aktivan" : customer.status}</Badge>
            </div>
            {customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${customer.email}`} className="text-primary hover:underline text-sm">
                  {customer.email}
                </a>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${customer.phone}`} className="text-primary hover:underline text-sm">
                  {customer.phone}
                </a>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ukupna vrijednost:</span>
              <span className="font-semibold text-primary">{customer.totalPurchases.toLocaleString()} KM</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Zadnji kontakt:</span>
              <span className="text-sm">{customer.lastContact || "Nikad"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Omiljeni proizvodi</CardTitle>
          </CardHeader>
          <CardContent>
            {customer.favoriteProducts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {customer.favoriteProducts.map((product, idx) => (
                  <Badge key={idx} variant="secondary">
                    {product}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nema podataka</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Razgovori po datumima
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setShowAddActivity(!showAddActivity)}
            data-testid="button-add-activity"
          >
            <Plus className="h-4 w-4 mr-1" />
            Dodaj belesku
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddActivity && (
            <div className="p-4 rounded-md border border-border bg-card space-y-3">
              <Textarea
                placeholder="Šta ste pričali sa kupcem..."
                value={newActivityNotes}
                onChange={(e) => setNewActivityNotes(e.target.value)}
                className="resize-none"
                data-testid="textarea-activity-notes"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddActivity(false)}
                  data-testid="button-cancel-activity"
                >
                  Otkaži
                </Button>
                <Button
                  size="sm"
                  onClick={() => newActivityNotes.trim() && addActivityMutation.mutate(newActivityNotes)}
                  disabled={!newActivityNotes.trim() || addActivityMutation.isPending}
                  data-testid="button-save-activity"
                >
                  {addActivityMutation.isPending ? "Čuvam..." : "Čuva"}
                </Button>
              </div>
            </div>
          )}

          {customerActivities.length > 0 ? (
            <div className="space-y-3">
              {customerActivities.map((activity) => {
                const ActivityIcon = activityTypeIcons[activity.type] || MessageSquare;
                return (
                  <div
                    key={activity.id}
                    className="p-3 rounded-md border border-border hover-elevate"
                    data-testid={`activity-item-${activity.id}`}
                  >
                    {editingActivityId === activity.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingActivityNotes}
                          onChange={(e) => setEditingActivityNotes(e.target.value)}
                          className="resize-none"
                          data-testid={`textarea-edit-activity-${activity.id}`}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingActivityId(null)}
                            data-testid="button-cancel-edit"
                          >
                            Otkaži
                          </Button>
                          <Button
                            size="sm"
                            onClick={() =>
                              editingActivityNotes.trim() &&
                              editActivityMutation.mutate({ id: activity.id, notes: editingActivityNotes })
                            }
                            disabled={!editingActivityNotes.trim() || editActivityMutation.isPending}
                            data-testid={`button-save-edit-${activity.id}`}
                          >
                            {editActivityMutation.isPending ? "Ažuriram..." : "Ažuriraj"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3 flex-1">
                            <ActivityIcon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  {activityTypeLabels[activity.type] || activity.type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(activity.createdAt), "d. MMMM yyyy 'u' HH:mm", { locale: bs })}
                                </span>
                              </div>
                              {activity.notes && (
                                <p className="text-sm text-foreground mt-2">{activity.notes}</p>
                              )}
                              {activity.outcome && (
                                <p className="text-xs text-muted-foreground mt-1">Ishod: {activity.outcome}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        {activity.type === "note" && (
                          <div className="flex justify-end pt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingActivityId(activity.id);
                                setEditingActivityNotes(activity.notes || "");
                              }}
                              data-testid={`button-edit-activity-${activity.id}`}
                            >
                              Uredi
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nema razgovora sa ovim kupcem</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
