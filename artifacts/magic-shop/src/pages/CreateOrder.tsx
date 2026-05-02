import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, ShoppingCart, Users, Package, Check, ChevronsUpDown, Calendar, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { isPromotionActive, type Customer, type Product, type ProductSize, type Sale } from "@workspace/db/schema";

type ProductWithSizes = Product & { sizes?: ProductSize[] };

interface OrderItem {
  productId: number;
  productName: string;
  // Veličina je obavezna ako artikal ima definisane veličine. Držimo
  // i ime radi prikaza (sizeName) i kompletan popis dostupnih veličina za
  // dropdown (productSizes) — kako se ne bi morao stalno tražiti u listi
  // produkata.
  sizeId?: number;
  sizeName?: string;
  productSizes?: ProductSize[];
  quantity: number;
  price: string;
  discount: string;
  total: number;
  isPromo?: boolean;
}

const PDV_RATE = 0.17;

// Pomoćna: trenutni lokalni datum+vrijeme u formatu "yyyy-MM-ddTHH:mm"
// koji prima <input type="datetime-local">.
const nowAsLocalInput = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");

export default function CreateOrder() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState<{ [key: number]: boolean }>({});
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  // Datum + vrijeme narudžbe — može mijenjati samo admin / sales_director.
  // Za sales_manager uvijek ostaje "trenutni trenutak" (server postavlja defaultNow).
  const [orderDateLocal, setOrderDateLocal] = useState<string>(nowAsLocalInput);
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

  const { data: lastDiscounts } = useQuery<Record<string, string>>({
    queryKey: ["/api/sales/last-discounts", selectedCustomerId],
    enabled: !!selectedCustomerId,
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

  const createSales = useMutation({
    mutationFn: async (items: OrderItem[]) => {
      const customerId = parseInt(selectedCustomerId);
      // Ako admin/sales_director eksplicitno bira datum, šaljemo isti createdAt
      // za svaku stavku — tako sve ostaju grupisane pod istom narudžbom u
      // prikazu Narudžbe (koji grupira po customerId + minuti).
      const createdAtIso = canEditDate
        ? new Date(orderDateLocal).toISOString()
        : undefined;

      // Serijski (jedan po jedan) — da bi DB id i createdAt rasli istim
      // redoslijedom kojim je korisnik unio stavke. Paralelni Promise.all
      // bi davao nedeterministički poredak u prikazu narudžbe.
      const results = [];
      for (const item of items) {
        const payload: Record<string, unknown> = {
          customerId,
          productId: item.productId,
          quantity: item.quantity,
          totalAmount: item.total.toFixed(2),
          discount: item.discount || "0",
          status: "completed",
        };
        if (item.sizeId) payload.sizeId = item.sizeId;
        if (createdAtIso) payload.createdAt = createdAtIso;
        const res = await apiRequest("POST", "/api/sales", payload);
        results.push(res);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/last-discounts"] });
      toast({
        title: "Uspješno",
        description: "Narudžba je uspješno kreirana",
      });
      setSelectedCustomerId("");
      setOrderItems([]);
      setOrderDateLocal(nowAsLocalInput());
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
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const calculateItemTotal = (item: OrderItem) => {
    const qty = typeof item.quantity === 'string' ? parseInt(item.quantity as string) || 0 : (item.quantity || 0);
    const baseTotal = parseFloat(item.price || "0") * qty;
    const discountAmount = baseTotal * (parseFloat(item.discount || "0") / 100);
    return baseTotal - discountAmount;
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...orderItems];
    
    if (field === "productId") {
      // Search ALL products, not just topProducts
      const product = products.find((p) => p.id === parseInt(value));
      if (product) {
        const promoActive = isPromotionActive(product);
        const effectivePrice = promoActive && product.promoPrice ? product.promoPrice : product.price;
        // Kod aktivne akcije ne primjenjujemo "zadnji rabat" — akcijska cijena je već snižena.
        const lastDiscount = lastDiscounts?.[String(product.id)];
        const discount = promoActive
          ? "0"
          : (lastDiscount && lastDiscount !== "" ? lastDiscount : "0");
        newItems[index].productId = product.id;
        newItems[index].productName = product.name;
        newItems[index].price = effectivePrice;
        newItems[index].discount = discount;
        newItems[index].isPromo = promoActive;
        // Veličine artikla — ako postoje, korisnik ih MORA odabrati prije
        // slanja. Resetujemo prethodno odabrane sizeId/Name jer su vezane
        // za prethodni artikal.
        newItems[index].productSizes = product.sizes ?? [];
        newItems[index].sizeId = undefined;
        newItems[index].sizeName = undefined;
        newItems[index].total = calculateItemTotal({
          ...newItems[index],
          price: effectivePrice,
          discount,
        });
      }
    } else if (field === "sizeId") {
      const sizeIdNum = value === "" || value === null || value === undefined ? undefined : parseInt(value);
      newItems[index].sizeId = sizeIdNum;
      const sz = newItems[index].productSizes?.find((s) => s.id === sizeIdNum);
      newItems[index].sizeName = sz?.name;
    } else if (field === "quantity") {
      // Allow empty string while typing
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
      // Allow empty string or just typing while clearing
      const val = value;
      if (val === "" || val === null || val === undefined) {
        newItems[index].discount = "" as any;
      } else {
        newItems[index].discount = val;
      }
      newItems[index].total = calculateItemTotal(newItems[index]);
    } else if (field === "price") {
      // Komercijalista može ručno izmijeniti cijenu nakon auto-popune (i akcijske).
      newItems[index].price = value === "" || value === null || value === undefined ? "" : String(value);
      // Kad se cijena ručno mijenja, više ne reklamiramo "akcijska cijena primijenjena".
      newItems[index].isPromo = false;
      newItems[index].total = calculateItemTotal(newItems[index]);
    }

    setOrderItems(newItems);
  };

  const handleQuantityBlur = (index: number) => {
    const newItems = [...orderItems];
    const currentQty = newItems[index].quantity;
    
    // If empty or invalid, set to 1
    if (typeof currentQty === "string" || currentQty === null || currentQty === undefined || currentQty < 1) {
      newItems[index].quantity = 1;
    }

    // Ensure discount is at least "0" on blur
    if (!newItems[index].discount || newItems[index].discount === "") {
      newItems[index].discount = "0";
    }

    newItems[index].total = calculateItemTotal(newItems[index]);
    setOrderItems(newItems);
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
    
    // Validate product selection
    const unselectedProduct = orderItems.find(item => !item.productId || item.productId === 0);
    if (unselectedProduct) {
      toast({
        title: "Greška",
        description: "Molimo odaberite artikal za sve stavke",
        variant: "destructive",
      });
      return;
    }

    // Validate veličina — ako artikal ima veličine, ona mora biti odabrana
    const missingSize = orderItems.find(
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
    
    // Validate totals are valid numbers
    const invalidTotal = orderItems.find(item => isNaN(item.total));
    if (invalidTotal) {
      toast({
        title: "Greška",
        description: "Nevažeći ukupni iznos",
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
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-create-order">
          <ShoppingCart className="h-6 w-6" />
          Nova narudžba
        </h1>
        <p className="text-muted-foreground">Kreirajte novu narudžbu za kupca</p>
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
                    data-testid="select-customer"
                  >
                    {selectedCustomerId
                      ? customers.find((c) => String(c.id) === selectedCustomerId)?.name + " - " + customers.find((c) => String(c.id) === selectedCustomerId)?.company
                      : "Odaberi kupca..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-[90vw] sm:w-[400px] max-w-full p-0">
                  <Command>
                    <CommandInput placeholder="Pretraži kupce..." data-testid="input-search-customer" />
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

            {canEditDate && (
              <div className="space-y-2">
                <Label htmlFor="order-date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Datum i vrijeme narudžbe
                </Label>
                <Input
                  id="order-date"
                  type="datetime-local"
                  value={orderDateLocal}
                  onChange={(e) => setOrderDateLocal(e.target.value)}
                  data-testid="input-order-date"
                />
                <p className="text-xs text-muted-foreground">
                  Po default-u trenutni datum i vrijeme. Možeš izmijeniti ako se narudžba kuca naknadno.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
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
          <CardContent className="space-y-4 overflow-x-hidden px-2 sm:px-6">
            {orderItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nema dodanih proizvoda. Kliknite "Dodaj proizvod" da započnete.
              </p>
            ) : (
              orderItems.map((item, index) => {
                const itemTotal = calculateItemTotal(item);
                const itemWithoutVAT = itemTotal / (1 + PDV_RATE);
                return (
                <div
                  key={index}
                  className="space-y-3 p-2 sm:p-4 border rounded-lg w-full min-w-0 overflow-hidden"
                  data-testid={`order-item-${index}`}
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
                            data-testid={`select-product-${index}`}
                          >
                            <span className="truncate">{item.productName || "Odaberi artikal"}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent side="bottom" align="start" className="w-[90vw] sm:w-[400px] max-w-full p-0">
                          <Command>
                            <CommandInput placeholder="Pretraži proizvode..." data-testid={`input-search-product-${index}`} />
                            <CommandList className="max-h-40 overflow-y-auto">
                              <CommandEmpty>Nema pronađenih proizvoda.</CommandEmpty>

                              {promoProducts.length > 0 && (
                                <CommandGroup heading="Akcija">
                                  {promoProducts.map((product) => (
                                    <CommandItem
                                      key={`promo-${product.id}`}
                                      value={`akcija ${product.name}`}
                                      onSelect={() => {
                                        updateOrderItem(index, "productId", String(product.id));
                                        setProductSearchOpen({ ...productSearchOpen, [index]: false });
                                      }}
                                      data-testid={`promo-option-${index}-${product.id}`}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          item.productId === product.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span>{product.name}</span>
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

                    {item.isPromo && (
                      <div
                        className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive"
                        data-testid={`promo-indicator-${index}`}
                      >
                        <Tag className="h-3.5 w-3.5" />
                        <span className="font-semibold">Akcijska cijena primijenjena</span>
                      </div>
                    )}

                    {/* Veličina — prikazuje se samo ako odabrani artikal ima
                        definisane veličine. Korisnik je MORA odabrati prije
                        slanja narudžbe (validacija u handleSubmit). */}
                    {item.productSizes && item.productSizes.length > 0 && (
                      <div className="w-full min-w-0">
                        <Label className="text-xs sm:text-sm block truncate">
                          Veličina <span className="text-destructive">*</span>
                        </Label>
                        <select
                          value={item.sizeId ?? ""}
                          onChange={(e) => updateOrderItem(index, "sizeId", e.target.value)}
                          className="w-full text-xs sm:text-sm h-9 rounded-md border border-input bg-background px-3"
                          data-testid={`select-size-${index}`}
                        >
                          <option value="">— odaberi veličinu —</option>
                          {item.productSizes.map((s) => (
                            <option key={s.id} value={s.id} data-testid={`size-option-${index}-${s.id}`}>
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
                        onChange={(e) => updateOrderItem(index, "price", e.target.value)}
                        className={cn("w-full text-xs sm:text-sm", item.isPromo && "bg-destructive/10 text-destructive font-semibold")}
                        data-testid={`input-price-${index}`}
                      />
                    </div>

                    <div className="w-full min-w-0">
                      <Label className="text-xs sm:text-sm block truncate">Količina</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(index, "quantity", e.target.value)}
                        onBlur={() => handleQuantityBlur(index)}
                        className="w-full text-xs sm:text-sm"
                        data-testid={`input-quantity-${index}`}
                      />
                    </div>

                    <div className="w-full min-w-0">
                      <Label className="text-xs sm:text-sm block truncate">Rabat %</Label>
                      <Input
                        type="number"
                        value={item.discount}
                        onChange={(e) => updateOrderItem(index, "discount", e.target.value)}
                        className="w-full text-xs sm:text-sm"
                        min="0"
                        max="100"
                        data-testid={`input-discount-${index}`}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => removeOrderItem(index)}
                      data-testid={`button-remove-item-${index}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Ukloni
                    </Button>
                  </div>

                  <div className="grid gap-2 grid-cols-3 text-[10px] sm:text-xs pt-1 border-t">
                    <div>
                      <span className="text-muted-foreground text-[9px] sm:text-xs">Bez PDV:</span>
                      <p className="font-semibold text-[10px] sm:text-xs">{itemWithoutVAT.toFixed(2)} KM</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[9px] sm:text-xs">PDV (17%):</span>
                      <p className="font-semibold text-[10px] sm:text-xs">{(itemTotal - itemWithoutVAT).toFixed(2)} KM</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[9px] sm:text-xs">Sa PDV:</span>
                      <p className="font-semibold text-[10px] sm:text-xs">{itemTotal.toFixed(2)} KM</p>
                    </div>
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
