import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ShoppingCart, Users, Package } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Product } from "@shared/schema";

interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
  price: string;
  total: number;
}

export default function CreateOrder() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const { toast } = useToast();

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

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
    if (products.length > 0) {
      const firstProduct = products[0];
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
      const product = products.find((p) => p.id === parseInt(value));
      if (product) {
        newItems[index].productId = product.id;
        newItems[index].productName = product.name;
        newItems[index].price = product.price;
        newItems[index].total = parseFloat(product.price) * newItems[index].quantity;
      }
    } else if (field === "quantity") {
      const parsedQty = parseInt(value);
      const qty = isNaN(parsedQty) || parsedQty < 1 ? 1 : parsedQty;
      newItems[index].quantity = qty;
      newItems[index].total = parseFloat(newItems[index].price) * qty;
    }

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
              <Label htmlFor="customer">Odaberi kupca *</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger id="customer" data-testid="select-customer">
                  <SelectValue placeholder="Odaberi kupca..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={String(customer.id)}>
                      {customer.name} - {customer.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto] items-end p-4 border rounded-lg"
                  data-testid={`order-item-${index}`}
                >
                  <div>
                    <Label>Proizvod</Label>
                    <Select
                      value={String(item.productId)}
                      onValueChange={(value) => updateOrderItem(index, "productId", value)}
                    >
                      <SelectTrigger data-testid={`select-product-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={String(product.id)}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateOrderItem(index, "quantity", e.target.value)}
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
