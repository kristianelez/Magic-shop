import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, ChevronsUpDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Customer, Product, Sale } from "@shared/schema";

interface OfferItem {
  productId: number;
  quantity: number;
  price: string;
  category: string;
  productName?: string;
}

interface Offer {
  id: number;
  customerId: number;
  salesPersonId?: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  items?: OfferItem[];
}

export default function Offers() {
  const { toast } = useToast();
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [items, setItems] = useState<OfferItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [productSearchOpen, setProductSearchOpen] = useState(false);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: sales = [] } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  const { data: offers = [] } = useQuery<Offer[]>({
    queryKey: ["/api/offers"],
  });

  // Sortiraj proizvode po broju prodaja (najprodavljiviji prvi)
  const sortedProducts = useMemo(() => {
    const productSales: { [key: number]: number } = {};
    sales.forEach((sale) => {
      productSales[sale.productId] = (productSales[sale.productId] || 0) + sale.quantity;
    });
    
    return [...products]
      .map((p) => ({ ...p, totalSold: productSales[p.id] || 0 }))
      .sort((a, b) => b.totalSold - a.totalSold);
  }, [products, sales]);

  const createOfferMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer || items.length === 0) {
        throw new Error("Odaberi kupca i dodaj artikle");
      }

      const totalAmount = items.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity,
        0
      );

      const offer = await apiRequest("POST", "/api/offers", {
        customerId: parseInt(selectedCustomer),
        totalAmount: totalAmount.toString(),
        status: "draft",
      });

      for (const item of items) {
        await apiRequest("POST", "/api/offers/items", {
          offerId: offer.id,
          ...item,
        });
      }

      return offer;
    },
    onSuccess: () => {
      toast({ title: "Uspješno", description: "Ponuda je kreirana" });
      setSelectedCustomer("");
      setItems([]);
      queryClient.invalidateQueries({ queryKey: ["/api/offers"] });
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message || "Nije moguće kreirati ponudu",
        variant: "destructive",
      });
    },
  });

  const deleteOfferMutation = useMutation({
    mutationFn: async (offerId: number) => {
      return await apiRequest("DELETE", `/api/offers/${offerId}`, {});
    },
    onSuccess: () => {
      toast({ title: "Uspješno", description: "Ponuda je obrisana" });
      queryClient.invalidateQueries({ queryKey: ["/api/offers"] });
    },
  });

  const handleAddItem = () => {
    if (!selectedProduct || !quantity) return;

    const product = products.find((p: any) => p.id === parseInt(selectedProduct));
    if (!product) return;

    const newItem: OfferItem = {
      productId: parseInt(selectedProduct),
      quantity: parseInt(quantity),
      price: product.price,
      category: product.category,
      productName: product.name,
    };

    setItems([...items, newItem]);
    setSelectedProduct("");
    setQuantity("1");
    setProductSearchOpen(false);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce(
    (sum, item) => sum + parseFloat(item.price) * item.quantity,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="heading-offers">Ponude</h1>
        <p className="text-muted-foreground">Kreiraj i upravljaj ponudama</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Kreiraj novu ponudu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Odaberi kupca</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      data-testid="select-customer"
                    >
                      {selectedCustomer
                        ? customers.find((c) => String(c.id) === selectedCustomer)?.name
                        : "Odaberi kupca..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput placeholder="Pretraži kupce..." data-testid="input-search-customer" />
                      <CommandList>
                        <CommandEmpty>Nema pronađenih kupaca.</CommandEmpty>
                        <CommandGroup heading="Kupci">
                          {customers.map((customer: any) => (
                            <CommandItem
                              key={customer.id}
                              value={`${customer.name} ${customer.company}`}
                              onSelect={() => {
                                setSelectedCustomer(String(customer.id));
                              }}
                              data-testid={`customer-item-${customer.id}`}
                            >
                              <span>{customer.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">({customer.company})</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Dodaj artikle</label>
                <div className="flex gap-2">
                  <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productSearchOpen}
                        className="flex-1 justify-between"
                        data-testid="select-product"
                      >
                        {selectedProduct
                          ? products.find((p) => String(p.id) === selectedProduct)?.name
                          : "Odaberi proizvod..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Pretraži proizvode..." data-testid="input-search-products" />
                        <CommandList>
                          <CommandEmpty>Nema pronađenih proizvoda.</CommandEmpty>
                          <CommandGroup heading="Najprodavljiviji proizvodi">
                            {sortedProducts.slice(0, 10).map((product: any) => (
                              <CommandItem
                                key={product.id}
                                value={`${product.name} ${product.category}`}
                                onSelect={() => {
                                  setSelectedProduct(String(product.id));
                                  setProductSearchOpen(false);
                                }}
                                data-testid={`product-item-${product.id}`}
                              >
                                <span>{product.name}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({product.category}) {product.totalSold > 0 && `${product.totalSold} kom`}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          <CommandGroup heading="Svi proizvodi">
                            {sortedProducts.slice(10).map((product: any) => (
                              <CommandItem
                                key={product.id}
                                value={`${product.name} ${product.category}`}
                                onSelect={() => {
                                  setSelectedProduct(String(product.id));
                                  setProductSearchOpen(false);
                                }}
                                data-testid={`product-item-${product.id}`}
                              >
                                <span>{product.name}</span>
                                <span className="text-xs text-muted-foreground ml-2">({product.category})</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="number"
                    placeholder="Kol."
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-20"
                    data-testid="input-quantity"
                  />
                  <Button onClick={handleAddItem} data-testid="button-add-item">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {items.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Artikli u ponudi</label>
                  <div className="border rounded-md divide-y">
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 text-sm"
                        data-testid={`offer-item-${idx}`}
                      >
                        <div className="flex-1">
                          <p className="font-medium">
                            {products.find((p: any) => p.id === item.productId)?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} x {item.price} KM = {(parseFloat(item.price) * item.quantity).toFixed(2)} KM
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(idx)}
                          data-testid={`button-remove-item-${idx}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="font-semibold">Ukupno:</span>
                    <span className="text-lg font-bold">{totalAmount.toFixed(2)} KM</span>
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => createOfferMutation.mutate()}
                disabled={!selectedCustomer || items.length === 0 || createOfferMutation.isPending}
                data-testid="button-create-offer"
              >
                {createOfferMutation.isPending ? "Kreiram..." : "Kreiraj ponudu"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Ponude ({offers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {offers.map((offer: any) => (
                  <div
                    key={offer.id}
                    className="border rounded-md p-2 text-sm"
                    data-testid={`offer-card-${offer.id}`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="font-medium">
                          {customers.find((c: any) => c.id === offer.customerId)?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {offer.items?.length || 0} artikala
                        </p>
                        <p className="font-semibold mt-1">{offer.totalAmount} KM</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteOfferMutation.mutate(offer.id)}
                        data-testid={`button-delete-offer-${offer.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
