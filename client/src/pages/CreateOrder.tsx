import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, ShoppingCart, Users, Package, Check, ChevronsUpDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Customer, Product, Sale } from "@shared/schema";

interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
  price: string;
  total: number;
}

export default function CreateOrder() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState<{ [key: number]: boolean }>({});
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
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

  const createSales = useMutation({
    mutationFn: async (items: OrderItem[]) => {
      const customerId = parseInt(selectedCustomerId);
      const salesPromises = items.map((item) =>
        apiRequest("POST", "/api/sales", {
          customerId,
          productId: item.productId,
          quantity: item.quantity,
          totalAmount: item.total.toFixed(2),
          status: "completed",
        })
      );
      return await Promise.all(salesPromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast({
        title: "Uspješno",
        description: "Narudžba je uspješno kreirana",
      });
      setSelectedCustomerId("");
      setOrderItems([]);
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message || "Nije moguće kreirati narudžbu",
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
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...orderItems];
    
    if (field === "productId") {
      // Search ALL products, not just topProducts
      const product = products.find((p) => p.id === parseInt(value));
      if (product) {
        newItems[index].productId = product.id;
        newItems[index].productName = product.name;
        newItems[index].price = product.price;
        newItems[index].total = parseFloat(product.price) * newItems[index].quantity;
      }
    } else if (field === "quantity") {
      // Allow empty string while typing
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
    
    // If empty or invalid, set to 1
    if (typeof currentQty === "string" || currentQty === null || currentQty === undefined || currentQty < 1) {
      newItems[index].quantity = 1;
      newItems[index].total = parseFloat(newItems[index].price) * 1;
      setOrderItems(newItems);
    }
  };

  const totalAmount = orderItems.reduce((sum, item) => sum + item.total, 0);

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
    if (orderItems.length === 0) {
      toast({
        title: "Greška",
        description: "Molimo dodajte barem jedan proizvod",
        variant: "destructive",
      });
      return;
    }
    
    // Validate quantities
    const invalidItem = orderItems.find(item => !item.quantity || item.quantity <= 0);
    if (invalidItem) {
      toast({
        title: "Greška",
        description: "Količina mora biti pozitivan broj",
        variant: "destructive",
      });
      return;
    }
    
    createSales.mutate(orderItems);
  };

  if (customersLoading || productsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Učitavam...</p>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-create-order">
            <ShoppingCart className="h-6 w-6" />
            Nova narudžba
          </h1>
          <p className="text-muted-foreground">Kreirajte novu narudžbu za kupca</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nema kupaca</h3>
              <p className="text-muted-foreground mb-4">
                Molimo prvo dodajte kupce prije kreiranja narudžbi
              </p>
              <Button asChild data-testid="button-goto-customers">
                <a href="/customers">Dodaj kupce</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-create-order">
            <ShoppingCart className="h-6 w-6" />
            Nova narudžba
          </h1>
          <p className="text-muted-foreground">Kreirajte novu narudžbu za kupca</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nema proizvoda</h3>
              <p className="text-muted-foreground mb-4">
                Molimo prvo dodajte proizvode prije kreiranja narudžbi
              </p>
              <Button asChild data-testid="button-goto-products">
                <a href="/products">Dodaj proizvode</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-create-order">
          <ShoppingCart className="h-6 w-6" />
          Nova narudžba
        </h1>
        <p className="text-muted-foreground">Kreirajte novu narudžbu za kupca</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informacije o kupcu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Odaberi ili pretraži kupca *</Label>
              <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerSearchOpen}
                    className="w-full justify-between"
                    data-testid="select-customer"
                  >
                    {selectedCustomerId
                      ? customers.find((c) => String(c.id) === selectedCustomerId)?.name + " - " + customers.find((c) => String(c.id) === selectedCustomerId)?.company
                      : "Odaberi kupca..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Pretraži kupce..." data-testid="input-search-customer" />
                    <CommandList>
                      <CommandEmpty>Nema pronađenih kupaca.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={`${customer.name} ${customer.company}`}
                            onSelect={() => {
                              setSelectedCustomerId(String(customer.id));
                              setCustomerSearchOpen(false);
                            }}
                            data-testid={`customer-option-${customer.id}`}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedCustomerId === String(customer.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {customer.name} - {customer.company}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Proizvodi</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOrderItem}
              data-testid="button-add-item"
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj proizvod
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {orderItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nema dodanih proizvoda. Kliknite "Dodaj proizvod" da započnete.
              </p>
            ) : (
              orderItems.map((item, index) => (
                <div
                  key={index}
                  className="grid gap-4 grid-cols-1 sm:grid-cols-[2fr_1fr] md:grid-cols-[2fr_1fr_1fr_1fr_auto] items-end p-4 border rounded-lg"
                  data-testid={`order-item-${index}`}
                >
                  <div>
                    <Label>Proizvod</Label>
                    <Popover 
                      open={productSearchOpen[index] || false} 
                      onOpenChange={(open) => setProductSearchOpen({ ...productSearchOpen, [index]: open })}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={productSearchOpen[index] || false}
                          className="w-full justify-between"
                          data-testid={`select-product-${index}`}
                        >
                          {item.productName}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0">
                        <Command>
                          <CommandInput placeholder="Pretraži proizvode..." data-testid={`input-search-product-${index}`} />
                          <CommandList>
                            <CommandEmpty>Nema pronađenih proizvoda.</CommandEmpty>
                            
                            {/* Top 10 Suggested Products */}
                            {topProducts.length > 0 && (
                              <CommandGroup heading="Preporučeni proizvodi (Top 10)">
                                {topProducts.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={product.name}
                                    onSelect={() => {
                                      updateOrderItem(index, "productId", String(product.id));
                                      setProductSearchOpen({ ...productSearchOpen, [index]: false });
                                    }}
                                    data-testid={`product-option-${index}-${product.id}`}
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
                            )}
                            
                            {/* All Products */}
                            <CommandGroup heading="Svi proizvodi">
                              {products.map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={product.name}
                                  onSelect={() => {
                                    updateOrderItem(index, "productId", String(product.id));
                                    setProductSearchOpen({ ...productSearchOpen, [index]: false });
                                  }}
                                  data-testid={`all-products-option-${index}-${product.id}`}
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
                                      {product.category} | Cijena: {product.price} KM
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
                      data-testid={`input-price-${index}`}
                    />
                  </div>

                  <div>
                    <Label>Količina</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={item.quantity}
                      onChange={(e) => updateOrderItem(index, "quantity", e.target.value)}
                      onBlur={() => handleQuantityBlur(index)}
                      data-testid={`input-quantity-${index}`}
                    />
                  </div>

                  <div>
                    <Label>Ukupno (KM)</Label>
                    <Input
                      type="text"
                      value={item.total.toFixed(2)}
                      readOnly
                      className="bg-muted font-semibold"
                      data-testid={`input-total-${index}`}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOrderItem(index)}
                    data-testid={`button-remove-item-${index}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
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

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSelectedCustomerId("");
              setOrderItems([]);
            }}
            data-testid="button-cancel-order"
          >
            Otkaži
          </Button>
          <Button type="submit" disabled={createSales.isPending} data-testid="button-submit-order">
            {createSales.isPending ? "Kreiram..." : "Kreiraj narudžbu"}
          </Button>
        </div>
      </form>
    </div>
  );
}
