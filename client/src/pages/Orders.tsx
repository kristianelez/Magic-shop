import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Calendar, Package, Users } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { bs } from "date-fns/locale";
import type { Sale, Customer, Product } from "@shared/schema";

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
    productId: number;
    productName: string;
    quantity: number;
    price: string;
    total: string;
  }[];
  totalAmount: number;
  status: string;
}

export default function Orders() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  );
  const [selectedYear, setSelectedYear] = useState<string>(String(currentDate.getFullYear()));

  const { data: sales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const isLoading = salesLoading || customersLoading || productsLoading;

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
      };
      acc.push(order);
    }

    const itemTotal = parseFloat(sale.totalAmount);
    order.items.push({
      productId: product.id,
      productName: product.name,
      quantity: sale.quantity,
      price: (itemTotal / sale.quantity).toFixed(2),
      total: itemTotal.toFixed(2),
    });
    order.totalAmount += itemTotal;

    return acc;
  }, []);

  // Sortiraj po datumu (najnovije prvo)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-orders">
            <ShoppingCart className="h-6 w-6" />
            Narudžbe
          </h1>
          <p className="text-muted-foreground">Pregled svih narudžbi sa filterima</p>
        </div>
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
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold" data-testid={`customer-name-${order.id}`}>
                            {order.customerName}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{order.customerCompany}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground" data-testid={`order-date-${order.id}`}>
                            {format(order.orderDate, 'dd.MM.yyyy HH:mm', { locale: bs })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary" data-testid={`order-total-${order.id}`}>
                          {order.totalAmount.toFixed(2)} KM
                        </p>
                        <Badge variant={order.status === "completed" ? "secondary" : "outline"} className="mt-2">
                          {order.status === "completed" ? "Završeno" : "Na čekanju"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Proizvod</TableHead>
                          <TableHead className="text-right">Količina</TableHead>
                          <TableHead className="text-right">Cijena</TableHead>
                          <TableHead className="text-right">Ukupno</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {order.items.map((item, idx) => (
                          <TableRow key={idx} data-testid={`order-item-${order.id}-${idx}`}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{item.price} KM</TableCell>
                            <TableCell className="text-right font-semibold">{item.total} KM</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
    </div>
  );
}
