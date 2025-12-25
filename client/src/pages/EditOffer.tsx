import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, FileText, Users, Package, Check, ChevronsUpDown, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Customer, Product, Sale } from "@shared/schema";

interface OfferItem {
  id?: number;
  productId: number;
  productName: string;
  quantity: number;
  price: string;
  discount: string;
  category: string;
}

const PDV_RATE = 0.17;

export default function EditOffer() {
  const [, params] = useRoute("/edit-offer/:offerId");
  const [, setLocation] = useLocation();
  const offerId = params?.offerId ? parseInt(params.offerId) : null;
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [productSearchOpen, setProductSearchOpen] = useState<{ [key: number]: boolean }>({});
  const [items, setItems] = useState<OfferItem[]>([]);
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

  const { data: offer, isLoading: offerLoading } = useQuery<{
    id: number;
    customerId: number;
    totalAmount: string;
    status: string;
    items: Array<{
      id: number;
      productId: number;
      productName: string;
      quantity: number;
      price: string;
      discount: string;
      category: string;
    }>;
  }>({
    queryKey: ["/api/offers", offerId],
    enabled: !!offerId,
  });

  const sortedProducts = useMemo(() => {
    const productSales: { [key: number]: number } = {};
    sales.forEach((sale) => {
      productSales[sale.productId] = (productSales[sale.productId] || 0) + sale.quantity;
    });
    
    return [...products]
      .map((p) => ({ ...p, totalSold: productSales[p.id] || 0 }))
      .sort((a, b) => b.totalSold - a.totalSold);
  }, [products, sales]);

  useEffect(() => {
    if (!offer || isLoaded || customersLoading || productsLoading) return;
    
    setSelectedCustomerId(String(offer.customerId));
    
    const loadedItems: OfferItem[] = (offer.items || []).map((item: any) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName || products.find(p => p.id === item.productId)?.name || "N/A",
      quantity: item.quantity,
      price: item.price,
      discount: item.discount || "0",
      category: item.category || products.find(p => p.id === item.productId)?.category || "",
    }));

    setItems(loadedItems);
    setIsLoaded(true);
  }, [offer, isLoaded, customersLoading, productsLoading, products]);

  const calculateItemWithPDV = (item: OfferItem) => {
    const priceSaPDV = parseFloat(item.price) * item.quantity;
    const discountAmount = priceSaPDV * (parseFloat(item.discount || "0") / 100);
    return priceSaPDV - discountAmount;
  };

  const totalSaPDV = items.reduce((sum, item) => sum + calculateItemWithPDV(item), 0);
  const totalBezPDV = totalSaPDV / (1 + PDV_RATE);

  const updateOfferMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomerId || items.length === 0) {
        throw new Error("Odaberi kupca i dodaj artikle");
      }

      return await apiRequest("PATCH", `/api/offers/${offerId}`, {
        customerId: parseInt(selectedCustomerId),
        totalAmount: totalSaPDV.toFixed(2),
        status: "draft",
        items: items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount || "0",
          category: item.category,
        })),
      });
    },
    onSuccess: () => {
      toast({ title: "Uspješno", description: "Ponuda je ažurirana" });
      queryClient.invalidateQueries({ queryKey: ["/api/offers"] });
      setLocation("/offers");
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message || "Nije moguće ažurirati ponudu",
        variant: "destructive",
      });
    },
  });

  const handleAddItem = () => {
    if (sortedProducts.length > 0) {
      const firstProduct = sortedProducts[0];
      const newItem: OfferItem = {
        productId: firstProduct.id,
        productName: firstProduct.name,
        quantity: 1,
        price: firstProduct.price,
        discount: "0",
        category: firstProduct.category,
      };
      setItems([...items, newItem]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, productId: number) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        productId: product.id,
        productName: product.name,
        price: product.price,
        category: product.category,
      };
      setItems(newItems);
    }
  };

  const handleQuantityChange = (index: number, value: string) => {
    const newItems = [...items];
    if (value === "" || value === "0") {
      newItems[index].quantity = 0;
    } else {
      const parsed = parseInt(value);
      if (!isNaN(parsed) && parsed >= 0) {
        newItems[index].quantity = parsed;
      }
    }
    setItems(newItems);
  };

  const handleQuantityBlur = (index: number) => {
    if (items[index].quantity === 0 || items[index].quantity < 1) {
      const newItems = [...items];
      newItems[index].quantity = 1;
      setItems(newItems);
    }
  };

  const handleDiscountChange = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index].discount = value;
    setItems(newItems);
  };

  const handleDiscountBlur = (index: number) => {
    if (!items[index].discount || items[index].discount === "") {
      const newItems = [...items];
      newItems[index].discount = "0";
      setItems(newItems);
    }
  };

  const selectedCustomer = customers.find(c => c.id === parseInt(selectedCustomerId));

  if (!offerId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Nevažeća ponuda</p>
      </div>
    );
  }

  if (offerLoading || customersLoading || productsLoading || !isLoaded) {
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
          onClick={() => setLocation("/offers")}
          data-testid="button-back-to-offers"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-edit-offer">
            <FileText className="h-6 w-6" />
            Uredi ponudu
          </h1>
          <p className="text-muted-foreground">Izmjena postojeće ponude #{offerId}</p>
        </div>
      </div>

      <div className="space-y-6 overflow-x-hidden">
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
                <p className="font-semibold">{selectedCustomer?.name || "N/A"}</p>
                {selectedCustomer && (
                  <p className="text-sm text-muted-foreground">{selectedCustomer.company}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Proizvodi
            </CardTitle>
            <Button
              type="button"
              size="sm"
              onClick={handleAddItem}
              disabled={sortedProducts.length === 0}
              data-testid="button-add-product"
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj proizvod
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 overflow-x-hidden px-2 sm:px-6">
            {items.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nema dodanih proizvoda. Kliknite "Dodaj proizvod" da započnete.
              </p>
            ) : (
              items.map((item, idx) => {
                const itemTotal = calculateItemWithPDV(item);
                const itemWithoutVAT = itemTotal / (1 + PDV_RATE);
                return (
                  <div
                    key={idx}
                    className="space-y-3 p-2 sm:p-4 border rounded-lg w-full min-w-0 overflow-hidden"
                    data-testid={`offer-item-${idx}`}
                  >
                    <div className="space-y-2 sm:space-y-3 w-full min-w-0">
                      <div className="w-full min-w-0">
                        <Label className="text-xs sm:text-sm block truncate">Proizvod</Label>
                        <Popover 
                          open={productSearchOpen[idx] || false}
                          onOpenChange={(open) => setProductSearchOpen({ ...productSearchOpen, [idx]: open })}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={productSearchOpen[idx] || false}
                              className="w-full justify-between overflow-hidden"
                              data-testid={`select-product-${idx}`}
                            >
                              <span className="truncate flex-1 text-left">{item.productName}</span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent side="bottom" align="start" className="w-[90vw] sm:w-[400px] max-w-full p-0">
                            <Command>
                              <CommandInput placeholder="Pretraži proizvode..." data-testid={`input-search-product-${idx}`} />
                              <CommandList className="max-h-40 overflow-y-auto">
                                <CommandEmpty>Nema pronađenih proizvoda.</CommandEmpty>
                                
                                {sortedProducts.slice(0, 10).length > 0 && (
                                  <CommandGroup heading="Preporučeni proizvodi (Top 10)">
                                    {sortedProducts.slice(0, 10).map((product) => (
                                      <CommandItem
                                        key={product.id}
                                        value={product.name}
                                        onSelect={() => {
                                          handleProductChange(idx, product.id);
                                          setProductSearchOpen({ ...productSearchOpen, [idx]: false });
                                        }}
                                        data-testid={`product-option-${idx}-${product.id}`}
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
                                  {sortedProducts.map((product) => (
                                    <CommandItem
                                      key={product.id}
                                      value={product.name}
                                      onSelect={() => {
                                        handleProductChange(idx, product.id);
                                        setProductSearchOpen({ ...productSearchOpen, [idx]: false });
                                      }}
                                      data-testid={`all-products-option-${idx}-${product.id}`}
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

                      <div className="w-full min-w-0">
                        <Label className="text-xs sm:text-sm block truncate">Cijena (KM)</Label>
                        <Input
                          type="text"
                          value={item.price}
                          readOnly
                          className="bg-muted w-full text-xs sm:text-sm"
                          data-testid={`input-price-${idx}`}
                        />
                      </div>

                      <div className="w-full min-w-0">
                        <Label className="text-xs sm:text-sm block truncate">Količina</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={item.quantity === 0 ? "" : item.quantity}
                          onChange={(e) => handleQuantityChange(idx, e.target.value)}
                          onBlur={() => handleQuantityBlur(idx)}
                          className="w-full text-xs sm:text-sm"
                          data-testid={`input-quantity-${idx}`}
                        />
                      </div>

                      <div className="w-full min-w-0">
                        <Label className="text-xs sm:text-sm block truncate">Rabat %</Label>
                        <Input
                          type="number"
                          value={item.discount}
                          onChange={(e) => handleDiscountChange(idx, e.target.value)}
                          onBlur={() => handleDiscountBlur(idx)}
                          className="w-full text-xs sm:text-sm"
                          min="0"
                          max="100"
                          data-testid={`input-discount-${idx}`}
                        />
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleRemoveItem(idx)}
                        data-testid={`button-remove-item-${idx}`}
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
                {totalSaPDV.toFixed(2)} KM
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation("/offers")}
            data-testid="button-cancel"
          >
            Otkaži
          </Button>
          <Button
            onClick={() => updateOfferMutation.mutate()}
            disabled={items.length === 0 || updateOfferMutation.isPending}
            data-testid="button-submit"
          >
            {updateOfferMutation.isPending ? "Ažuriram..." : "Ažuriraj ponudu"}
          </Button>
        </div>
      </div>
    </div>
  );
}
