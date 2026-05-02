import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, ShoppingCart, Users, Package, Check, ChevronsUpDown, ArrowLeft, Calendar, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { isPromotionActive, type Customer, type Product, type ProductSize, type Sale } from "@shared/schema";

type ProductWithSizes = Product & { sizes?: ProductSize[] };

interface OrderItem {
  saleId?: number;
  productId: number;
  productName: string;
  // Veličina je obavezna ako artikal ima definisane veličine.
  sizeId?: number;
  sizeName?: string;
  productSizes?: ProductSize[];
  quantity: number | string;
  price: string;
  discount: string;
  total: number;
  isDeleted?: boolean;
  isPromo?: boolean;
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
  // Datum + vrijeme narudžbe — može mijenjati samo admin / sales_director.
  // Format: "yyyy-MM-ddTHH:mm" (lokalno vrijeme, kompatibilno s <input type="datetime-local">).
  const [orderDateLocal, setOrderDateLocal] = useState<string>("");
  const [originalOrderDateLocal, setOriginalOrderDateLocal] = useState<string>("");
  const { toast } = useToast();
  const { user } = useAuth();
  const canEditDate = user?.role === "admin" || user?.role === "sales_director";

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<ProductWithSizes[]>({
    queryKey: ["/api/products"],
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  // Trenutno aktivne akcije
  const promoProducts = useMemo(
    () => products.filter((p) => isPromotionActive(p)),
    [products],
  );

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

    // Pronađi sve sale zapise za ovu narudžbu i sortiraj po id rastuće
    // kako bi prikaz pratio redoslijed unosa (manji id = ranije unesena stavka).
    const orderSales = sales
      .filter((sale) => {
        const saleDate = format(new Date(sale.createdAt), 'yyyy-MM-dd-HH:mm');
        return sale.customerId === customerId && saleDate === dateTimeStr;
      })
      .sort((a, b) => a.id - b.id);

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
    // Koristimo jediničnu cijenu iz prodaje (totalAmount/quantity) - to je cijena koja je zapravo naplaćena
    // Rabat postavljamo na 0 jer je cijena već efektivna cijena (uključujući bilo kakav prethodni rabat)
    const items: OrderItem[] = orderSales.map((sale) => {
      const product = products.find(p => p.id === sale.productId);
      const itemTotal = parseFloat(sale.totalAmount);
      const unitPrice = sale.quantity > 0 ? itemTotal / sale.quantity : 0;
      const sizeMatch = sale.sizeId
        ? product?.sizes?.find((s) => s.id === sale.sizeId)
        : undefined;

      return {
        saleId: sale.id,
        productId: sale.productId,
        productName: product?.name || "Unknown",
        sizeId: sale.sizeId ?? undefined,
        sizeName: sizeMatch?.name,
        productSizes: product?.sizes ?? [],
        quantity: sale.quantity,
        price: unitPrice.toFixed(2),
        discount: "0",
        total: itemTotal,
      };
    });

    setOrderItems(items);

    // Inicijaliziraj datum narudžbe iz prvog sale zapisa (svi su isti za grupu)
    const firstCreatedAt = new Date(orderSales[0].createdAt);
    const initialDate = format(firstCreatedAt, "yyyy-MM-dd'T'HH:mm");
    setOrderDateLocal(initialDate);
    setOriginalOrderDateLocal(initialDate);

    setIsLoaded(true);
  }, [orderId, sales, customers, products, isLoaded, salesLoading, customersLoading, productsLoading, toast, setLocation]);

  const updateOrder = useMutation({
    mutationFn: async (items: OrderItem[]) => {
      const customerId = parseInt(selectedCustomerId);

      // Ako je admin/sales_director promijenio datum, šaljemo ga uz svaku
      // stavku da bi sve ostale grupisane pod istim datumom u prikazu narudžbi.
      const dateChanged = canEditDate && orderDateLocal !== originalOrderDateLocal;
      const newCreatedAtIso = dateChanged
        ? new Date(orderDateLocal).toISOString()
        : undefined;

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
          // Ako artikal NEMA definisane veličine, sizeId mora biti
          // EKSPLICITNO null u PATCH payload-u — inače bi backend (koji
          // gleda postojeću prodaju kad sizeId nedostaje u body-ju)
          // pomislio da i dalje treba stara veličina sa prethodnog
          // (sizing) artikla. Isto vrijedi i za PATCH na non-sized
          // artiklu gdje je korisnik prebacio sa sized na non-sized.
          const hasSizes = (item.productSizes?.length ?? 0) > 0;
          const sizeIdForPayload: number | null = hasSizes
            ? (item.sizeId as number)
            : null;

          if (item.saleId) {
            // Update postojećeg sale zapisa
            const payload: Record<string, unknown> = {
              quantity: typeof item.quantity === 'string' ? parseInt(item.quantity) : item.quantity,
              totalAmount: item.total.toFixed(2),
              productId: item.productId,
              sizeId: sizeIdForPayload,
            };
            if (newCreatedAtIso) payload.createdAt = newCreatedAtIso;
            return apiRequest("PATCH", `/api/sales/${item.saleId}`, payload);
          } else {
            // Kreiraj novi sale zapis. Ako je datum mijenjan, koristi novi;
            // inače pusti server da postavi defaultNow() — nove stavke će
            // dobiti današnji datum, što normalno ne želimo unutar postojeće
            // narudžbe, pa ako datum NIJE promijenjen šaljemo originalni.
            const payload: Record<string, unknown> = {
              customerId,
              productId: item.productId,
              quantity: typeof item.quantity === 'string' ? parseInt(item.quantity) : item.quantity,
              totalAmount: item.total.toFixed(2),
              status: "completed",
            };
            if (sizeIdForPayload !== null) payload.sizeId = sizeIdForPayload;
            if (canEditDate) {
              payload.createdAt = new Date(orderDateLocal).toISOString();
            }
            return apiRequest("POST", "/api/sales", payload);
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

  const calculateItemTotal = (item: OrderItem) => {
    const qty = typeof item.quantity === 'string' ? parseInt(item.quantity as string) || 0 : (item.quantity || 0);
    const baseTotal = parseFloat(item.price || "0") * qty;
    const discountAmount = baseTotal * (parseFloat(item.discount || "0") / 100);
    return baseTotal - discountAmount;
  };

  const addOrderItem = () => {
    setOrderItems([
      ...orderItems,
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
      const product = products.find((p) => p.id === parseInt(value));
      if (product) {
        const promoActive = isPromotionActive(product);
        const effectivePrice = promoActive && product.promoPrice ? product.promoPrice : product.price;
        newItems[index].productId = product.id;
        newItems[index].productName = product.name;
        newItems[index].price = effectivePrice;
        newItems[index].isPromo = promoActive;
        // Resetuj veličinu jer je vezana za prethodni artikal.
        newItems[index].productSizes = product.sizes ?? [];
        newItems[index].sizeId = undefined;
        newItems[index].sizeName = undefined;
        newItems[index].total = calculateItemTotal({ ...newItems[index], price: effectivePrice });
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
      if (value === "" || value === null || value === undefined) {
        newItems[index].discount = "" as any;
      } else {
        newItems[index].discount = value;
      }
      newItems[index].total = calculateItemTotal(newItems[index]);
    } else if (field === "price") {
      // Komercijalista može ručno izmijeniti cijenu nakon auto-popune (i akcijske).
      newItems[index].price = value === "" || value === null || value === undefined ? "" : String(value);
      newItems[index].isPromo = false;
      newItems[index].total = calculateItemTotal(newItems[index]);
    }

    setOrderItems(newItems);
  };

  const handleQuantityBlur = (index: number) => {
    const newItems = [...orderItems];
    const currentQty = newItems[index].quantity;
    
    if (typeof currentQty === "string" || currentQty === null || currentQty === undefined || currentQty < 1) {
      newItems[index].quantity = 1;
      newItems[index].total = calculateItemTotal({ ...newItems[index], quantity: 1 });
      setOrderItems(newItems);
    }
  };

  const handleDiscountBlur = (index: number) => {
    const newItems = [...orderItems];
    const currentDiscount = newItems[index].discount;
    
    if (currentDiscount === "" || currentDiscount === null || currentDiscount === undefined) {
      newItems[index].discount = "0";
      newItems[index].total = calculateItemTotal(newItems[index]);
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
    
    // Validate product selection
    const unselectedProduct = activeItems.find(item => !item.productId || item.productId === 0);
    if (unselectedProduct) {
      toast({
        title: "Greška",
        description: "Molimo odaberite artikal za sve stavke",
        variant: "destructive",
      });
      return;
    }

    // Validate veličina — ako artikal ima veličine, ona mora biti odabrana
    const missingSize = activeItems.find(
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
    
    // Validate totals are valid numbers
    const invalidTotal = activeItems.find(item => isNaN(item.total));
    if (invalidTotal) {
      toast({
        title: "Greška",
        description: "Nevažeći ukupni iznos",
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
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Kupac</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="font-semibold">{customerName}</p>
                {selectedCustomer && (
                  <p className="text-sm text-muted-foreground">{selectedCustomer.company}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="order-date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Datum i vrijeme narudžbe
              </Label>
              {canEditDate ? (
                <>
                  <Input
                    id="order-date"
                    type="datetime-local"
                    value={orderDateLocal}
                    onChange={(e) => setOrderDateLocal(e.target.value)}
                    data-testid="input-order-date"
                  />
                  {orderDateLocal !== originalOrderDateLocal && (
                    <p className="text-xs text-muted-foreground" data-testid="text-date-changed-hint">
                      Datum je promijenjen — primijenit će se na sve stavke ove narudžbe nakon spremanja.
                    </p>
                  )}
                </>
              ) : (
                <div className="p-3 bg-muted rounded-md text-sm" data-testid="text-order-date-readonly">
                  {orderDateLocal
                    ? format(new Date(orderDateLocal), "dd.MM.yyyy HH:mm")
                    : "—"}
                </div>
              )}
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
              disabled={products.length === 0}
              data-testid="button-add-product"
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj proizvod
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 overflow-x-hidden px-2 sm:px-6">
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
                    className="space-y-3 p-2 sm:p-4 border rounded-lg w-full min-w-0 overflow-hidden"
                    data-testid={`order-item-${realIndex}`}
                  >
                    <div className="space-y-2 sm:space-y-3 w-full min-w-0">
                      <div className="w-full min-w-0">
                        <Label className="text-xs sm:text-sm block truncate">Proizvod (Top 10 najprodavanijih)</Label>
                        <Popover 
                          open={productSearchOpen[realIndex] || false} 
                          onOpenChange={(open) => setProductSearchOpen({ ...productSearchOpen, [realIndex]: open })}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={productSearchOpen[realIndex] || false}
                              className="w-full justify-between overflow-hidden"
                              data-testid={`select-product-${realIndex}`}
                            >
                              <span className="truncate flex-1 text-left">{item.productName || "Odaberi artikal"}</span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent side="bottom" align="start" className="w-[90vw] sm:w-[400px] max-w-full p-0">
                            <Command>
                              <CommandInput placeholder="Pretraži proizvode..." data-testid={`input-search-product-${realIndex}`} />
                              <CommandList className="max-h-40 overflow-y-auto">
                                <CommandEmpty>Nema pronađenih proizvoda.</CommandEmpty>

                                {promoProducts.length > 0 && (
                                  <CommandGroup heading="Akcija">
                                    {promoProducts.map((product) => (
                                      <CommandItem
                                        key={`promo-${product.id}`}
                                        value={`akcija ${product.name}`}
                                        onSelect={() => {
                                          updateOrderItem(realIndex, "productId", String(product.id));
                                          setProductSearchOpen({ ...productSearchOpen, [realIndex]: false });
                                        }}
                                        data-testid={`promo-option-${realIndex}-${product.id}`}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            item.productId === product.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="truncate">{product.name}</span>
                                            <Badge variant="destructive" className="text-[10px]">AKCIJA</Badge>
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            <span className="text-destructive font-semibold">{parseFloat(product.promoPrice!).toFixed(2)} KM</span>
                                            <span className="line-through ml-2">{parseFloat(product.price).toFixed(2)} KM</span>
                                          </div>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}

                                {topProducts.length > 0 && (
                                  <CommandGroup heading="Preporučeni proizvodi (Top 10)">
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
                                        <div className="flex-1 min-w-0">
                                          <div className="truncate">{product.name}</div>
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
                                        updateOrderItem(realIndex, "productId", String(product.id));
                                        setProductSearchOpen({ ...productSearchOpen, [realIndex]: false });
                                      }}
                                      data-testid={`all-products-option-${realIndex}-${product.id}`}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          item.productId === product.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="truncate">{product.name}</div>
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

                      {item.isPromo && (
                        <div
                          className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive"
                          data-testid={`promo-indicator-${realIndex}`}
                        >
                          <Tag className="h-3.5 w-3.5" />
                          <span className="font-semibold">Akcijska cijena primijenjena</span>
                        </div>
                      )}

                      {/* Veličina — obavezna ako artikal ima definisane veličine */}
                      {item.productSizes && item.productSizes.length > 0 && (
                        <div className="w-full min-w-0">
                          <Label className="text-xs sm:text-sm block truncate">
                            Veličina <span className="text-destructive">*</span>
                          </Label>
                          <select
                            value={item.sizeId ?? ""}
                            onChange={(e) => updateOrderItem(realIndex, "sizeId", e.target.value)}
                            className="w-full text-xs sm:text-sm h-9 rounded-md border border-input bg-background px-3"
                            data-testid={`select-size-${realIndex}`}
                          >
                            <option value="">— odaberi veličinu —</option>
                            {item.productSizes.map((s) => (
                              <option key={s.id} value={s.id} data-testid={`size-option-${realIndex}-${s.id}`}>
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
                          inputMode="decimal"
                          value={item.price}
                          onChange={(e) => updateOrderItem(realIndex, "price", e.target.value)}
                          className={cn("w-full text-xs sm:text-sm", item.isPromo && "bg-destructive/10 text-destructive font-semibold")}
                          data-testid={`input-price-${realIndex}`}
                        />
                      </div>

                      <div className="w-full min-w-0">
                        <Label className="text-xs sm:text-sm block truncate">Količina</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={item.quantity}
                          onChange={(e) => updateOrderItem(realIndex, "quantity", e.target.value)}
                          onBlur={() => handleQuantityBlur(realIndex)}
                          className="w-full text-xs sm:text-sm"
                          data-testid={`input-quantity-${realIndex}`}
                        />
                      </div>

                      <div className="w-full min-w-0">
                        <Label className="text-xs sm:text-sm block truncate">Rabat (%)</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={item.discount}
                          onChange={(e) => updateOrderItem(realIndex, "discount", e.target.value)}
                          onBlur={() => handleDiscountBlur(realIndex)}
                          disabled={!item.productId || item.productId === 0}
                          className="w-full text-xs sm:text-sm"
                          data-testid={`input-discount-${realIndex}`}
                        />
                      </div>

                      <div className="w-full min-w-0">
                        <Label className="text-xs sm:text-sm block truncate">Ukupno (KM)</Label>
                        <Input
                          type="text"
                          value={item.total.toFixed(2)}
                          readOnly
                          className="bg-muted font-semibold w-full text-xs sm:text-sm"
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
