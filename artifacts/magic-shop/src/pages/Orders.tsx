import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Calendar, Package, Users, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { bs } from "date-fns/locale";
import type { Sale, Customer, Product, ProductSize } from "@workspace/db/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

type ProductWithSizes = Product & { sizes?: ProductSize[] };

interface SaleWithDetails extends Sale {
  customer?: Customer;
  product?: Product;
}

interface GroupedOrder {
  id: string;
  customerId: number;
  customerName: string;
  customerCompany: string;
  orderDate: Date;
  items: {
    saleId: number;
    productId: number;
    productName: string;
    sizeName?: string;
    quantity: number;
    price: string;
    total: string;
  }[];
  totalAmount: number;
  status: string;
  invoiceVerified: boolean;
}

export default function Orders() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  );
  const [selectedYear, setSelectedYear] = useState<string>(String(currentDate.getFullYear()));
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [selectedOrderForDelete, setSelectedOrderForDelete] = useState<{ id: string; items: GroupedOrder["items"] } | null>(null);

  const { data: sales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<ProductWithSizes[]>({
    queryKey: ["/api/products"],
  });

  const isLoading = salesLoading || customersLoading || productsLoading;

  const deleteOrderMutation = useMutation({
    mutationFn: async (saleIds: number[]) => {
      for (const saleId of saleIds) {
        await apiRequest("DELETE", `/api/sales/${saleId}`);
      }
    },
    onSuccess: () => {
      toast({
        title: "Uspješno",
        description: "Narudžba je obrisana",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      setShowDeleteAlert(false);
      setSelectedOrderForDelete(null);
    },
    onError: () => {
      toast({
        title: "Greška",
        description: "Nije moguće obrisati narudžbu",
        variant: "destructive",
      });
    },
  });

  const verifyInvoiceMutation = useMutation({
    mutationFn: async ({ saleIds, verified }: { saleIds: number[]; verified: boolean }) => {
      return await apiRequest("POST", "/api/sales/verify-invoice", { saleIds, verified });
    },
    onSuccess: () => {
      toast({
        title: "Uspješno",
        description: "Status fakture je ažuriran",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    },
    onError: () => {
      toast({
        title: "Greška",
        description: "Nije moguće ažurirati status fakture",
        variant: "destructive",
      });
    },
  });

  // Grupa narudžbe po kupcu i datumu (isti kupac + isti datum = jedna narudžba)
  const groupedOrders: GroupedOrder[] = sales.reduce((acc: GroupedOrder[], sale) => {
    const customer = customers.find(c => c.id === sale.customerId);
    const product = products.find(p => p.id === sale.productId);
    
    if (!customer || !product) return acc;

    const orderDate = new Date(sale.createdAt);
    const orderKey = `${sale.customerId}-${format(orderDate, 'yyyy-MM-dd-HH:mm')}`;
    
    let order = acc.find(o => o.id === orderKey);
    
    if (!order) {
      order = {
        id: orderKey,
        customerId: sale.customerId,
        customerName: customer.name,
        customerCompany: customer.company,
        orderDate: orderDate,
        items: [],
        totalAmount: 0,
        status: sale.status,
        invoiceVerified: (sale as any).invoiceVerified === "true",
      };
      acc.push(order);
    }

    const itemTotal = parseFloat(sale.totalAmount);
    // Ako je prodaja zabilježila veličinu, prikazat ćemo je u zagradi pored
    // naziva artikla — npr. "Majica (M)". Ime veličine vadimo iz eager-loaded
    // sizes (vidi GET /api/products koji vraća product.sizes).
    const sizeName = sale.sizeId
      ? product.sizes?.find((s) => s.id === sale.sizeId)?.name
      : undefined;
    order.items.push({
      saleId: sale.id,
      productId: product.id,
      productName: product.name,
      sizeName,
      quantity: sale.quantity,
      price: (itemTotal / sale.quantity).toFixed(2),
      total: itemTotal.toFixed(2),
    });
    order.totalAmount += itemTotal;
    // Ako je bilo koji sale u grupi verified, smatraj cijelu narudžbu verified
    if ((sale as any).invoiceVerified === "true") {
      order.invoiceVerified = true;
    }

    return acc;
  }, []);

  // Sortiraj stavke unutar svake narudžbe po saleId rastuće — to je
  // redoslijed kojim je korisnik unosio stavke u "Nova narudžba"
  // (CreateOrder kreira sale zapise serijski, pa veći id = kasniji unos).
  groupedOrders.forEach((order) => {
    order.items.sort((a, b) => a.saleId - b.saleId);
  });

  // Sortiraj narudžbe po datumu (najnovije prvo)
  groupedOrders.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());

  // Filtriraj po mjesecu
  const filteredOrders = groupedOrders.filter(order => {
    const orderMonth = format(order.orderDate, 'yyyy-MM');
    return orderMonth === selectedMonth;
  });

  // Generiši listu mjeseci za filter (zadnjih 12 mjeseci)
  const months = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    months.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: bs }),
    });
  }

  // Generiši listu godina
  const years = [];
  const currentYear = currentDate.getFullYear();
  for (let i = 0; i < 5; i++) {
    years.push(currentYear - i);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Učitavam narudžbe...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-orders">
          <ShoppingCart className="h-6 w-6" />
          Narudžbe
        </h1>
        <p className="text-muted-foreground">Pregled svih narudžbi sa filterima</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <CardTitle>Filtriraj po mjesecu</CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px]" data-testid="select-month">
                  <SelectValue placeholder="Odaberi mjesec" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nema narudžbi</h3>
              <p className="text-muted-foreground">
                Nema narudžbi za odabrani mjesec.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <Card key={order.id} className="hover-elevate" data-testid={`order-${order.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <h3 className="font-semibold truncate" data-testid={`customer-name-${order.id}`}>
                            {order.customerName}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{order.customerCompany}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <p className="text-xs text-muted-foreground" data-testid={`order-date-${order.id}`}>
                            {format(order.orderDate, 'dd.MM.yyyy HH:mm', { locale: bs })}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-start sm:items-end gap-2">
                        <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                          <p className="text-xl sm:text-2xl font-bold text-primary" data-testid={`order-total-${order.id}`}>
                            {order.totalAmount.toFixed(2)} KM
                          </p>
                          <Button
                            size="sm"
                            variant={order.invoiceVerified ? "default" : "outline"}
                            className={order.invoiceVerified ? "bg-green-600 hover:bg-green-700" : ""}
                            onClick={() => {
                              const saleIds = order.items.map(item => item.saleId);
                              verifyInvoiceMutation.mutate({ saleIds, verified: !order.invoiceVerified });
                            }}
                            disabled={verifyInvoiceMutation.isPending}
                            data-testid={`button-verify-invoice-${order.id}`}
                          >
                            {order.invoiceVerified ? (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Ovjereno
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 mr-1" />
                                Nije ovjereno
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLocation(`/edit-order/${encodeURIComponent(order.id)}`)}
                            data-testid={`button-edit-order-${order.id}`}
                            className="flex-1 sm:flex-none"
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Uredi
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedOrderForDelete({
                                id: order.id,
                                items: order.items,
                              });
                              setShowDeleteAlert(true);
                            }}
                            data-testid={`button-delete-order-${order.id}`}
                            className="flex-1 sm:flex-none"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Obriši
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {order.items.map((item, idx) => (
                        <div key={idx} data-testid={`order-item-${order.id}-${idx}`} className="pb-3 border-b last:border-b-0 last:pb-0">
                          <p className="font-medium text-sm truncate mb-2">
                            {item.productName}
                            {item.sizeName ? ` (${item.sizeName})` : ""}
                          </p>
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Količina: {item.quantity}</span>
                            <span>{item.price} KM</span>
                          </div>
                          <div className="flex justify-between text-sm font-semibold mt-1">
                            <span>Ukupno:</span>
                            <span>{item.total} KM</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {filteredOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Statistika za odabrani mjesec</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Ukupno narudžbi</p>
              <p className="text-2xl font-bold" data-testid="stat-total-orders">{filteredOrders.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Ukupan prihod</p>
              <p className="text-2xl font-bold text-primary" data-testid="stat-total-revenue">
                {filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0).toFixed(2)} KM
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Prosječna vrijednost</p>
              <p className="text-2xl font-bold" data-testid="stat-average-value">
                {filteredOrders.length > 0 
                  ? (filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0) / filteredOrders.length).toFixed(2)
                  : '0.00'
                } KM
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obriši narudzbu</AlertDialogTitle>
            <AlertDialogDescription>
              Sigurno želite obrisati ovu narudžbu? Ova radnja se ne može poništiti.
              {selectedOrderForDelete && selectedOrderForDelete.items.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="font-medium text-foreground">Stavke u narudžbi:</p>
                  <ul className="text-xs text-foreground space-y-1 break-words">
                    {selectedOrderForDelete.items.map((item, idx) => (
                      <li key={idx} className="truncate">
                        • {item.productName}
                        {item.sizeName ? ` (${item.sizeName})` : ""} x {item.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end pt-4">
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (selectedOrderForDelete) {
                  const saleIds = sales
                    .filter(sale => {
                      const saleDate = new Date(sale.createdAt);
                      const orderDate = groupedOrders.find(o => o.id === selectedOrderForDelete.id)?.orderDate;
                      return orderDate && 
                        sale.customerId === groupedOrders.find(o => o.id === selectedOrderForDelete.id)?.customerId &&
                        format(saleDate, 'yyyy-MM-dd-HH:mm') === format(orderDate, 'yyyy-MM-dd-HH:mm');
                    })
                    .map(s => s.id);
                  deleteOrderMutation.mutate(saleIds);
                }
              }}
              disabled={deleteOrderMutation.isPending}
              data-testid="button-confirm-delete-order"
            >
              {deleteOrderMutation.isPending ? "Brišem..." : "Obriši"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
