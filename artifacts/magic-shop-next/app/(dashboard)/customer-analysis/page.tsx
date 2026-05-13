"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Package, ShoppingBag, TrendingUp, Calendar } from "lucide-react";
import { format } from "date-fns";
import { bs } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Customer, Sale, Product } from "@workspace/db/schema";

export default function CustomerAnalysis() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    staleTime: 30 * 60 * 1000,
  });

  const { data: sales = [] } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    staleTime: 30 * 60 * 1000,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    staleTime: 30 * 60 * 1000,
  });

  const productMap = useMemo(() => {
    const m = new Map<number, Product>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const sortedCustomers = useMemo(
    () => [...customers].sort((a, b) => a.company.localeCompare(b.company)),
    [customers]
  );

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;

  const customerSales = useMemo(() => {
    if (!selectedCustomerId) return [];
    return sales
      .filter((s) => s.customerId === selectedCustomerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sales, selectedCustomerId]);

  const stats = useMemo(() => {
    if (customerSales.length === 0) {
      return { totalSpent: 0, totalOrders: 0, totalQuantity: 0, uniqueProducts: 0 };
    }
    const totalSpent = customerSales.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
    const totalQuantity = customerSales.reduce((sum, s) => sum + s.quantity, 0);
    const uniqueProducts = new Set(customerSales.map((s) => s.productId)).size;
    return {
      totalSpent,
      totalOrders: customerSales.length,
      totalQuantity,
      uniqueProducts,
    };
  }, [customerSales]);

  const productBreakdown = useMemo(() => {
    const byProduct = new Map<number, { name: string; category: string; quantity: number; revenue: number; lastBought: Date }>();
    customerSales.forEach((sale) => {
      const product = productMap.get(sale.productId);
      const existing = byProduct.get(sale.productId);
      const saleDate = new Date(sale.createdAt);
      if (existing) {
        existing.quantity += sale.quantity;
        existing.revenue += parseFloat(sale.totalAmount);
        if (saleDate > existing.lastBought) existing.lastBought = saleDate;
      } else {
        byProduct.set(sale.productId, {
          name: product?.name || `Artikal #${sale.productId}`,
          category: product?.category || "—",
          quantity: sale.quantity,
          revenue: parseFloat(sale.totalAmount),
          lastBought: saleDate,
        });
      }
    });
    return Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue);
  }, [customerSales, productMap]);

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="heading-customer-analysis">Analiza kupca</h1>
        <p className="text-muted-foreground">Pregled svih kupovina i artikala koje je kupac uzimao</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Odaberi kupca</CardTitle>
        </CardHeader>
        <CardContent>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between"
                data-testid="button-select-customer"
              >
                <span className="truncate">
                  {selectedCustomer
                    ? `${selectedCustomer.company} — ${selectedCustomer.name}`
                    : "Odaberi ili ukucaj ime kupca..."}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              className="w-[90vw] sm:w-[500px] max-w-full p-0"
            >
              <Command>
                <CommandInput
                  placeholder="Pretraži kupce po imenu ili kompaniji..."
                  data-testid="input-search-customer"
                />
                <CommandList className="max-h-72 overflow-y-auto">
                  <CommandEmpty>Nema pronađenih kupaca.</CommandEmpty>
                  <CommandGroup>
                    {sortedCustomers.map((customer) => {
                      const value = `${customer.company} ${customer.name}`;
                      return (
                        <CommandItem
                          key={customer.id}
                          value={value}
                          onSelect={() => {
                            setSelectedCustomerId(customer.id);
                            setOpen(false);
                          }}
                          data-testid={`option-customer-${customer.id}`}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium truncate">{customer.company}</span>
                            <span className="text-xs text-muted-foreground truncate">
                              {customer.name}
                            </span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {!selectedCustomer ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Odaberi kupca iz padajuće liste da bi vidio detaljnu analizu kupovina.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Ukupna vrijednost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" data-testid="stat-total-spent">
                  {stats.totalSpent.toFixed(2)} KM
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Broj kupovina
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" data-testid="stat-total-orders">
                  {stats.totalOrders}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Različitih artikala
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" data-testid="stat-unique-products">
                  {stats.uniqueProducts}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Ukupna količina
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" data-testid="stat-total-quantity">
                  {stats.totalQuantity}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                Pregled po artiklima
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {productBreakdown.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">
                  Ovaj kupac još nije imao nijednu kupovinu.
                </p>
              ) : (
                <div className="space-y-2">
                  {productBreakdown.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-md border border-border hover-elevate"
                      data-testid={`product-row-${idx}`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate" title={p.name}>
                            {p.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="secondary" className="text-[10px]">
                              {p.category}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Zadnje: {format(p.lastBought, "d. MMM yyyy", { locale: bs })}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-primary">
                            {p.revenue.toFixed(2)} KM
                          </p>
                          <p className="text-xs text-muted-foreground">{p.quantity} kom</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Hronologija kupovina
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {customerSales.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">
                  Nema evidentiranih kupovina.
                </p>
              ) : (
                <div className="space-y-2">
                  {customerSales.map((sale) => {
                    const product = productMap.get(sale.productId);
                    return (
                      <div
                        key={sale.id}
                        className="p-3 rounded-md border border-border hover-elevate"
                        data-testid={`sale-row-${sale.id}`}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">
                              {product?.name || `Artikal #${sale.productId}`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(sale.createdAt), "d. MMMM yyyy 'u' HH:mm", { locale: bs })}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-primary">
                              {parseFloat(sale.totalAmount).toFixed(2)} KM
                            </p>
                            <p className="text-xs text-muted-foreground">{sale.quantity} kom</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
