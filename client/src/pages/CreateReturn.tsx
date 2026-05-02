import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, RotateCcw, Users, Package, Check, ChevronsUpDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Customer, Product, ProductSize, Sale } from "@shared/schema";

type ProductWithSizes = Product & { sizes?: ProductSize[] };

interface ReturnItem {
  productId: number;
  productName: string;
  // Veličina je obavezna ako artikal ima definisane veličine — backend
  // odbija POST /api/sales bez sizeId za takve artikle.
  sizeId?: number;
  sizeName?: string;
  productSizes?: ProductSize[];
  quantity: number;
  price: string;
  discount: string;
  total: number;
}

const PDV_RATE = 0.17;

export default function CreateReturn() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState<{ [key: number]: boolean }>({});
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const { toast } = useToast();

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<ProductWithSizes[]>({
    queryKey: ["/api/products"],
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

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

  const createReturns = useMutation({
    mutationFn: async (items: ReturnItem[]) => {
      const customerId = parseInt(selectedCustomerId);
      const salesPromises = items.map((item) => {
        const payload: Record<string, unknown> = {
          customerId,
          productId: item.productId,
          quantity: -item.quantity,
          totalAmount: (-item.total).toFixed(2),
          status: "return",
        };
        if (item.sizeId) payload.sizeId = item.sizeId;
        return apiRequest("POST", "/api/sales", payload);
      });
      return await Promise.all(salesPromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast({
        title: "Uspješno",
        description: "Povrat robe je uspješno evidentiran",
      });
      setSelectedCustomerId("");
      setReturnItems([]);
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message || "Nije moguće evidentirati povrat",
        variant: "destructive",
      });
    },
  });

  const addReturnItem = () => {
    setReturnItems([
      ...returnItems,
      {
        productId: 0,
        productName: "",
        quantity: 1,
        price: "0",
        discount: "0",
        total: 0,
      },
    ]);
  };

  const removeReturnItem = (index: number) => {
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  const calculateItemTotal = (item: ReturnItem) => {
    const qty = typeof item.quantity === 'string' ? parseInt(item.quantity as string) || 0 : (item.quantity || 0);
    const baseTotal = parseFloat(item.price || "0") * qty;
    const discountAmount = baseTotal * (parseFloat(item.discount || "0") / 100);
    return baseTotal - discountAmount;
  };

  const updateReturnItem = (index: number, field: keyof ReturnItem, value: any) => {
    const newItems = [...returnItems];
    
    if (field === "productId") {
      const product = products.find((p) => p.id === parseInt(value));
      if (product) {
        newItems[index].productId = product.id;
        newItems[index].productName = product.name;
        newItems[index].price = product.price;
        // Resetuj veličinu — vezana je za prethodni artikal.
        newItems[index].productSizes = product.sizes ?? [];
        newItems[index].sizeId = undefined;
        newItems[index].sizeName = undefined;
        newItems[index].total = calculateItemTotal({ ...newItems[index], price: product.price });
      }
    } else if (field === "sizeId") {
      const sizeIdNum = value === "" || value === null || value === undefined ? undefined : parseInt(value);
      newItems[index].sizeId = sizeIdNum;
      const sz = newItems[index].productSizes?.find((s) => s.id === sizeIdNum);
      newItems[index].sizeName = sz?.name;
    } else if (field === "quantity") {
      if (value === "" || value === null || value === undefined) {
        newItems[index].quantity = "" as any;
        newItems[index].total = 0;
      } else {
        const parsedQty = parseInt(value);
        const qty = isNaN(parsedQty) || parsedQty < 1 ? 1 : parsedQty;
        newItems[index].quantity = qty;
        newItems[index].total = calculateItemTotal({ ...newItems[index], quantity: qty });
      }
    } else if (field === "discount") {
      const val = value;
      if (val === "" || val === null || val === undefined) {
        newItems[index].discount = "" as any;
      } else {
        newItems[index].discount = val;
      }
      newItems[index].total = calculateItemTotal(newItems[index]);
    }

    setReturnItems(newItems);
  };

  const handleQuantityBlur = (index: number) => {
    const newItems = [...returnItems];
    const currentQty = newItems[index].quantity;
    
    if (typeof currentQty === "string" || currentQty === null || currentQty === undefined || currentQty < 1) {
      newItems[index].quantity = 1;
    }

    if (!newItems[index].discount || newItems[index].discount === "") {
      newItems[index].discount = "0";
    }

    newItems[index].total = calculateItemTotal(newItems[index]);
    setReturnItems(newItems);
  };

  const totalAmount = returnItems.reduce((sum, item) => sum + item.total, 0);

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
    if (returnItems.length === 0) {
      toast({
        title: "Greška",
        description: "Molimo dodajte barem jedan proizvod za povrat",
        variant: "destructive",
      });
      return;
    }
    
    // Validate product selection
    const unselectedProduct = returnItems.find(item => !item.productId || item.productId === 0);
    if (unselectedProduct) {
      toast({
        title: "Greška",
        description: "Molimo odaberite artikal za sve stavke",
        variant: "destructive",
      });
      return;
    }

    // Veličina je obavezna ako artikal ima definisane veličine
    const missingSize = returnItems.find(
      (item) => (item.productSizes?.length ?? 0) > 0 && !item.sizeId,
    );
    if (missingSize) {
      toast({
        title: "Greška",
        description: `Odaberite veličinu za artikal "${missingSize.productName}"`,
        variant: "destructive",
      });
      return;
    }

    const invalidItem = returnItems.find(item => !item.quantity || item.quantity <= 0);
    if (invalidItem) {
      toast({
        title: "Greška",
        description: "Količina mora biti pozitivan broj",
        variant: "destructive",
      });
      return;
    }
    
    // Validate totals are valid numbers
    const invalidTotal = returnItems.find(item => isNaN(item.total));
    if (invalidTotal) {
      toast({
        title: "Greška",
        description: "Nevažeći ukupni iznos",
        variant: "destructive",
      });
      return;
    }
    
    createReturns.mutate(returnItems);
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
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-create-return">
            <RotateCcw className="h-6 w-6" />
            Povrat robe
          </h1>
          <p className="text-muted-foreground">Evidentirajte povrat robe od kupca</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nema kupaca</h3>
              <p className="text-muted-foreground mb-4">
                Molimo prvo dodajte kupce prije evidentiranja povrata
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
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-create-return">
            <RotateCcw className="h-6 w-6" />
            Povrat robe
          </h1>
          <p className="text-muted-foreground">Evidentirajte povrat robe od kupca</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nema proizvoda</h3>
              <p className="text-muted-foreground mb-4">
                Molimo prvo dodajte proizvode prije evidentiranja povrata
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
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-create-return">
          <RotateCcw className="h-6 w-6" />
          Povrat robe
        </h1>
        <p className="text-muted-foreground">Evidentirajte povrat robe od kupca (umanjuje promet i bonus)</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 overflow-x-hidden">
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
                    data-testid="select-customer-return"
                  >
                    {selectedCustomerId
                      ? customers.find((c) => String(c.id) === selectedCustomerId)?.name + " - " + customers.find((c) => String(c.id) === selectedCustomerId)?.company
                      : "Odaberi kupca..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-[90vw] sm:w-[400px] max-w-full p-0">
                  <Command>
                    <CommandInput placeholder="Pretraži kupce..." data-testid="input-search-customer-return" />
                    <CommandList className="max-h-40 overflow-y-auto">
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
                            data-testid={`customer-return-option-${customer.id}`}
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

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 gap-2">
            <CardTitle>Proizvodi za povrat</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addReturnItem}
              data-testid="button-add-return-item"
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj proizvod
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 overflow-x-hidden px-2 sm:px-6">
            {returnItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nema dodanih proizvoda. Kliknite "Dodaj proizvod" da započnete.
              </p>
            ) : (
              returnItems.map((item, index) => {
                const itemTotal = calculateItemTotal(item);
                const itemWithoutVAT = itemTotal / (1 + PDV_RATE);
                return (
                <div
                  key={index}
                  className="space-y-3 p-2 sm:p-4 border border-destructive/30 bg-destructive/5 rounded-lg w-full min-w-0 overflow-hidden"
                  data-testid={`return-item-${index}`}
                >
                  <div className="space-y-2 sm:space-y-3 w-full min-w-0">
                    <div className="w-full min-w-0">
                      <Label className="text-xs sm:text-sm block truncate">Proizvod</Label>
                      <Popover 
                        open={productSearchOpen[index] || false} 
                        onOpenChange={(open) => setProductSearchOpen({ ...productSearchOpen, [index]: open })}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={productSearchOpen[index] || false}
                            className="w-full justify-between truncate"
                            data-testid={`select-return-product-${index}`}
                          >
                            <span className="truncate">{item.productName || "Odaberi artikal"}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent side="bottom" align="start" className="w-[90vw] sm:w-[400px] max-w-full p-0">
                          <Command>
                            <CommandInput placeholder="Pretraži proizvode..." data-testid={`input-search-return-product-${index}`} />
                            <CommandList className="max-h-40 overflow-y-auto">
                              <CommandEmpty>Nema pronađenih proizvoda.</CommandEmpty>
                              
                              {topProducts.length > 0 && (
                                <CommandGroup heading="Preporučeni proizvodi (Top 10)">
                                  {topProducts.map((product) => (
                                    <CommandItem
                                      key={product.id}
                                      value={product.name}
                                      onSelect={() => {
                                        updateReturnItem(index, "productId", String(product.id));
                                        setProductSearchOpen({ ...productSearchOpen, [index]: false });
                                      }}
                                      data-testid={`return-product-option-${index}-${product.id}`}
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
                              
                              <CommandGroup heading="Svi proizvodi">
                                {products.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={product.name}
                                    onSelect={() => {
                                      updateReturnItem(index, "productId", String(product.id));
                                      setProductSearchOpen({ ...productSearchOpen, [index]: false });
                                    }}
                                    data-testid={`all-return-products-option-${index}-${product.id}`}
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

                    {/* Veličina — obavezna ako artikal ima definisane veličine */}
                    {item.productSizes && item.productSizes.length > 0 && (
                      <div className="w-full min-w-0">
                        <Label className="text-xs sm:text-sm block truncate">
                          Veličina <span className="text-destructive">*</span>
                        </Label>
                        <select
                          value={item.sizeId ?? ""}
                          onChange={(e) => updateReturnItem(index, "sizeId", e.target.value)}
                          className="w-full text-xs sm:text-sm h-9 rounded-md border border-input bg-background px-3"
                          data-testid={`select-return-size-${index}`}
                        >
                          <option value="">— odaberi veličinu —</option>
                          {item.productSizes.map((s) => (
                            <option key={s.id} value={s.id} data-testid={`return-size-option-${index}-${s.id}`}>
                              {s.name} (lager: {s.stock})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="w-full min-w-0">
                      <Label className="text-xs sm:text-sm block truncate">Cijena (KM)</Label>
                      <Input
                        type="text"
                        value={item.price}
                        readOnly
                        className="bg-muted w-full text-xs sm:text-sm"
                        data-testid={`input-return-price-${index}`}
                      />
                    </div>

                    <div className="w-full min-w-0">
                      <Label className="text-xs sm:text-sm block truncate">Količina</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={item.quantity}
                        onChange={(e) => updateReturnItem(index, "quantity", e.target.value)}
                        onBlur={() => handleQuantityBlur(index)}
                        className="w-full text-xs sm:text-sm"
                        data-testid={`input-return-quantity-${index}`}
                      />
                    </div>

                    <div className="w-full min-w-0">
                      <Label className="text-xs sm:text-sm block truncate">Rabat %</Label>
                      <Input
                        type="number"
                        value={item.discount}
                        onChange={(e) => updateReturnItem(index, "discount", e.target.value)}
                        className="w-full text-xs sm:text-sm"
                        min="0"
                        max="100"
                        data-testid={`input-return-discount-${index}`}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => removeReturnItem(index)}
                      data-testid={`button-remove-return-item-${index}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Ukloni
                    </Button>
                  </div>

                  <div className="grid gap-2 grid-cols-3 text-[10px] sm:text-xs pt-1 border-t border-destructive/30">
                    <div>
                      <span className="text-muted-foreground text-[9px] sm:text-xs">Bez PDV:</span>
                      <p className="font-semibold text-destructive text-[10px] sm:text-xs">-{itemWithoutVAT.toFixed(2)} KM</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[9px] sm:text-xs">PDV (17%):</span>
                      <p className="font-semibold text-destructive text-[10px] sm:text-xs">-{(itemTotal - itemWithoutVAT).toFixed(2)} KM</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[9px] sm:text-xs">Sa PDV:</span>
                      <p className="font-semibold text-destructive text-[10px] sm:text-xs">-{itemTotal.toFixed(2)} KM</p>
                    </div>
                  </div>
                </div>
              );
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Ukupan iznos povrata:</span>
              <span className="text-2xl text-destructive" data-testid="text-return-total-amount">
                -{totalAmount.toFixed(2)} KM
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
              setReturnItems([]);
            }}
            data-testid="button-cancel-return"
          >
            Otkaži
          </Button>
          <Button 
            type="submit" 
            variant="destructive"
            disabled={createReturns.isPending} 
            data-testid="button-submit-return"
          >
            {createReturns.isPending ? "Evidentiram..." : "Evidentiraj povrat"}
          </Button>
        </div>
      </form>
    </div>
  );
}
