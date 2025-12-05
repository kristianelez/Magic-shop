import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Product } from "@shared/schema";

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

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: offers = [] } = useQuery<Offer[]>({
    queryKey: ["/api/offers"],
  });

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
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger data-testid="select-customer">
                    <SelectValue placeholder="Odaberi kupca..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name} - {c.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Dodaj artikle</label>
                <div className="flex gap-2">
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger className="flex-1" data-testid="select-product">
                      <SelectValue placeholder="Odaberi proizvod..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p: any) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.name} ({p.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
