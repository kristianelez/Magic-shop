import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, ShoppingCart, Users, Package, Check, ChevronsUpDown, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Customer, Product, Sale } from "@shared/schema";

interface OrderItem {
  saleId?: number;
  productId: number;
  productName: string;
  quantity: number | string;
  price: string;
  total: number;
  isDeleted?: boolean;
}

export default function EditOrder() {
  const [, params] = useRoute("/edit-order/:orderId");
  const [, setLocation] = useLocation();
  const orderId = params?.orderId ? decodeURIComponent(params.orderId) : null;
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [productSearchOpen, setProductSearchOpen] = useState<{ [key: number]: boolean }>({});
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { toast } = useToast();

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  // Izračunaj top 10 najprodavanijih proizvoda
  const topProducts = useMemo(() => {
    const productSales: { [key: number]: number } = {};
    
    sales.forEach((sale) => {
      if (productSales[sale.productId]) {
        productSales[sale.productId] += sale.quantity;
      } else {
        productSales[sale.productId] = sale.quantity;
      }
    });

    const sortedProducts = products
      .map((product) => ({
        ...product,
        totalSold: productSales[product.id] || 0,
      }))
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 10);

    return sortedProducts;
  }, [products, sales]);

  // Učitaj postojeću narudžbu
  useEffect(() => {
    if (!orderId || isLoaded || salesLoading || customersLoading || productsLoading) return;
    
    // Parse order ID: "customerId-yyyy-MM-dd-HH:mm"
    const [customerIdStr, ...dateParts] = orderId.split('-');
    const customerId = parseInt(customerIdStr);
    const dateTimeStr = dateParts.join('-');
    
    // Pronađi sve sale zapise za ovu narudžbu
    const orderSales = sales.filter((sale) => {
      const saleDate = format(new Date(sale.createdAt), 'yyyy-MM-dd-HH:mm');
      return sale.customerId === customerId && saleDate === dateTimeStr;
    });

    if (orderSales.length === 0) {
      toast({
        title: "Greška",
        description: "Narudžba nije pronađena",
        variant: "destructive",
      });
      setLocation("/orders");
      return;
    }

    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setSelectedCustomerId(String(customerId));
      setCustomerName(customer.name);
    }

    // Popuni order items sa postojećim podacima
    const items: OrderItem[] = orderSales.map((sale) => {
      const product = products.find(p => p.id === sale.productId);
      const itemTotal = parseFloat(sale.totalAmount);
      const unitPrice = itemTotal / sale.quantity;
      
      return {
        saleId: sale.id,
        productId: sale.productId,
        productName: product?.name || "Unknown",
        quantity: sale.quantity,
        price: unitPrice.toFixed(2),
        total: itemTotal,
      };
    });

    setOrderItems(items);
    setIsLoaded(true);
  }, [orderId, sales, customers, products, isLoaded, salesLoading, customersLoading, productsLoading, toast, setLocation]);

  const updateOrder = useMutation({
    mutationFn: async (items: OrderItem[]) => {
      const customerId = parseInt(selectedCustomerId);
      
      // Prvo izbriši stavke koje su označene za brisanje
      const deletePromises = items
        .filter(item => item.isDeleted && item.saleId)
        .map(item => apiRequest("DELETE", `/api/sales/${item.saleId}`, {}));
      
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }

      // Update postojećih i kreiraj nove stavke
      const upsertPromises = items
        .filter(item => !item.isDeleted)
        .map((item) => {
          if (item.saleId) {
            // Update postojećeg sale zapisa
            return apiRequest("PATCH", `/api/sales/${item.saleId}`, {
              quantity: typeof item.quantity === 'string' ? parseInt(item.quantity) : item.quantity,
              totalAmount: item.total.toFixed(2),
            });
          } else {
            // Kreiraj novi sale zapis
            return apiRequest("POST", "/api/sales", {
              customerId,
              productId: item.productId,
              quantity: typeof item.quantity === 'string' ? parseInt(item.quantity) : item.quantity,
              totalAmount: item.total.toFixed(2),
              status: "completed",
            });
          }
        });

      return await Promise.all(upsertPromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast({
        title: "Uspješno",
        description: "Narudžba je uspješno ažurirana",
      });
      setLocation("/orders");
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message || "Nije moguće ažurirati narudžbu",
        variant: "destructive",
      });
    },
  });

  const addOrderItem = () => {
    if (topProducts.length > 0) {
      const firstProduct = topProducts[0];
      setOrderItems([
        ...orderItems,
        {
          productId: firstProduct.id,
          productName: firstProduct.name,
          quantity: 1,
          price: firstProduct.price,
          total: parseFloat(firstProduct.price),
        },
      ]);
    }
  };

  const removeOrderItem = (index: number) => {
    const item = orderItems[index];
    if (item.saleId) {
      // Označi za brisanje ako je postojeća stavka
      const newItems = [...orderItems];
      newItems[index].isDeleted = true;
      setOrderItems(newItems);
    } else {
      // Jednostavno ukloni ako je nova stavka
      setOrderItems(orderItems.filter((_, i) => i !== index));
    }
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...orderItems];
    
    if (field === "productId") {
      const product = topProducts.find((p) => p.id === parseInt(value));
      if (product) {
        newItems[index].productId = product.id;
        newItems[index].productName = product.name;
        newItems[index].price = product.price;
        const qty = typeof newItems[index].quantity === 'string' ? 
          parseInt(newItems[index].quantity as string) : newItems[index].quantity;
        newItems[index].total = parseFloat(product.price) * (qty as number);
      }
    } else if (field === "quantity") {
      if (value === "" || value === null || value === undefined) {
        newItems[index].quantity = "" as any;
        newItems[index].total = 0;
      } else {
        const parsedQty = parseInt(value);
        const qty = isNaN(parsedQty) || parsedQty < 1 ? 1 : parsedQty;
        newItems[index].quantity = qty;
        newItems[index].total = parseFloat(newItems[index].price) * qty;
      }
    }

    setOrderItems(newItems);
  };

  const handleQuantityBlur = (index: number) => {
    const newItems = [...orderItems];
    const currentQty = newItems[index].quantity;
    
    if (typeof currentQty === "string" || currentQty === null || currentQty === undefined || currentQty < 1) {
      newItems[index].quantity = 1;
      newItems[index].total = parseFloat(newItems[index].price) * 1;
      setOrderItems(newItems);
    }
  };

  const activeItems = orderItems.filter(item => !item.isDeleted);
  const totalAmount = activeItems.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast({
        title: "Greška",
        description: "Molimo odaberite kupca",
        variant: "destructive",
      });
      return;
    }
    if (activeItems.length === 0) {
      toast({
        title: "Greška",
        description: "Molimo dodajte barem jedan proizvod",
        variant: "destructive",
      });
      return;
    }
    
    const invalidItem = activeItems.find(item => {
      const qty = typeof item.quantity === 'string' ? parseInt(item.quantity) : item.quantity;
      return !item.quantity || isNaN(qty) || qty <= 0;
    });
    if (invalidItem) {
      toast({
        title: "Greška",
        description: "Količina mora biti pozitivan broj",
        variant: "destructive",
      });
      return;
    }

    updateOrder.mutate(orderItems);
  };

  const selectedCustomer = customers.find(c => c.id === parseInt(selectedCustomerId));

  if (!orderId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Nevažeća narudžba</p>
      </div>
    );
  }

  if (salesLoading || customersLoading || productsLoading || !isLoaded) {
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
          onClick={() => setLocation("/orders")}
          data-testid="button-back-to-orders"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-edit-order">
            <ShoppingCart className="h-6 w-6" />
            Uredi narudžbu
          </h1>
          <p className="text-muted-foreground">Izmjena postojeće narudžbe</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Informacije o kupcu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Kupac</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="font-semibold">{customerName}</p>
                {selectedCustomer && (
                  <p className="text-sm text-muted-foreground">{selectedCustomer.company}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Proizvodi
            </CardTitle>
            <Button
              type="button"
              size="sm"
              onClick={addOrderItem}
              disabled={topProducts.length === 0}
              data-testid="button-add-product"
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj proizvod
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nema dodanih proizvoda. Kliknite "Dodaj proizvod" da započnete.
              </p>
            ) : (
              activeItems.map((item, index) => {
                const realIndex = orderItems.findIndex(oi => oi === item);
                return (
                  <div
                    key={realIndex}
                    className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto] items-end p-4 border rounded-lg"
                    data-testid={`order-item-${realIndex}`}
                  >
                    <div>
                      <Label>Proizvod (Top 10 najprodavanijih)</Label>
                      <Popover 
                        open={productSearchOpen[realIndex] || false} 
                        onOpenChange={(open) => setProductSearchOpen({ ...productSearchOpen, [realIndex]: open })}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={productSearchOpen[realIndex] || false}
                            className="w-full justify-between"
                            data-testid={`select-product-${realIndex}`}
                          >
                            {item.productName}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent side="bottom" align="start" className="w-[90vw] sm:w-[400px] max-w-full p-0">
                          <Command>
                            <CommandInput placeholder="Pretraži proizvode..." data-testid={`input-search-product-${realIndex}`} />
                            <CommandList className="max-h-40 overflow-y-auto">
                              <CommandEmpty>Nema pronađenih proizvoda.</CommandEmpty>
                              <CommandGroup>
                                {topProducts.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={product.name}
                                    onSelect={() => {
                                      updateOrderItem(realIndex, "productId", String(product.id));
                                      setProductSearchOpen({ ...productSearchOpen, [realIndex]: false });
                                    }}
                                    data-testid={`product-option-${realIndex}-${product.id}`}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        item.productId === product.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex-1">
                                      <div>{product.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        Prodano: {product.totalSold} | Cijena: {product.price} KM
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label>Cijena (KM)</Label>
                      <Input
                        type="text"
                        value={item.price}
                        readOnly
                        className="bg-muted"
                        data-testid={`input-price-${realIndex}`}
                      />
                    </div>

                    <div>
                      <Label>Količina</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(realIndex, "quantity", e.target.value)}
                        onBlur={() => handleQuantityBlur(realIndex)}
                        data-testid={`input-quantity-${realIndex}`}
                      />
                    </div>

                    <div>
                      <Label>Ukupno (KM)</Label>
                      <Input
                        type="text"
                        value={item.total.toFixed(2)}
                        readOnly
                        className="bg-muted font-semibold"
                        data-testid={`input-total-${realIndex}`}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOrderItem(realIndex)}
                      data-testid={`button-remove-item-${realIndex}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Ukupan iznos:</span>
              <span className="text-2xl" data-testid="text-total-amount">
                {totalAmount.toFixed(2)} KM
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation("/orders")}
            data-testid="button-cancel"
          >
            Otkaži
          </Button>
          <Button
            type="submit"
            disabled={updateOrder.isPending || activeItems.length === 0}
            data-testid="button-submit"
          >
            {updateOrder.isPending ? "Ažuriram..." : "Ažuriraj narudžbu"}
          </Button>
        </div>
      </form>
    </div>
  );
}
