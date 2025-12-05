import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, ChevronsUpDown, Download, FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import jsPDF from "jspdf";
import type { Customer, Product, Sale } from "@shared/schema";

const PDV_RATE = 0.17;

interface OfferItem {
  productId: number;
  quantity: number;
  price: string;
  discount: string;
  category: string;
  productName: string;
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
  const { user } = useAuth();
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [items, setItems] = useState<OfferItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);

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

  const sortedProducts = useMemo(() => {
    const productSales: { [key: number]: number } = {};
    sales.forEach((sale) => {
      productSales[sale.productId] = (productSales[sale.productId] || 0) + sale.quantity;
    });
    
    return [...products]
      .map((p) => ({ ...p, totalSold: productSales[p.id] || 0 }))
      .sort((a, b) => b.totalSold - a.totalSold);
  }, [products, sales]);

  // VAŽNO: Cijene u bazi već UKLJUČUJU 17% PDV
  // Cijena sa PDV-om = item.price (originalna cijena iz baze)
  // Cijena bez PDV-a = item.price / 1.17
  const calculateItemWithPDV = (item: OfferItem) => {
    const priceSaPDV = parseFloat(item.price) * item.quantity;
    const discountAmount = priceSaPDV * (parseFloat(item.discount || "0") / 100);
    return priceSaPDV - discountAmount;
  };

  const calculateItemBezPDV = (item: OfferItem) => {
    const totalSaPDV = calculateItemWithPDV(item);
    return totalSaPDV / (1 + PDV_RATE);
  };

  const totalSaPDV = items.reduce((sum, item) => sum + calculateItemWithPDV(item), 0);
  const totalBezPDV = totalSaPDV / (1 + PDV_RATE);
  const pdvIznos = totalSaPDV - totalBezPDV;

  const createOfferMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer || items.length === 0) {
        throw new Error("Odaberi kupca i dodaj artikle");
      }

      const offerRes = await apiRequest("POST", "/api/offers", {
        customerId: parseInt(selectedCustomer),
        totalAmount: totalSaPDV.toFixed(2),
        status: "draft",
      });
      const offer = await offerRes.json();

      for (const item of items) {
        await apiRequest("POST", "/api/offers/items", {
          offerId: offer.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount || "0",
          category: item.category,
          productName: item.productName,
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
      discount: "0",
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

  const handleDiscountChange = (index: number, discountValue: string) => {
    const newItems = [...items];
    newItems[index].discount = discountValue;
    setItems(newItems);
  };

  const generatePDF = (offer: Offer) => {
    const customer = customers.find((c) => c.id === offer.customerId);
    const doc = new jsPDF();
    
    // Naslov
    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.text("PONUDA", 105, 20, { align: "center" });
    
    // Broj ponude i datum
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.text(`Broj ponude: ${offer.id}`, 20, 35);
    doc.text(`Datum: ${format(new Date(offer.createdAt), "dd.MM.yyyy")}`, 20, 42);
    
    // Podaci o kupcu - naslov
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("Podaci o kupcu:", 20, 55);
    
    // Podaci o kupcu - sadrzaj
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.text(`Naziv: ${customer?.name || "N/A"}`, 20, 63);
    doc.text(`Kompanija: ${customer?.company || "N/A"}`, 20, 70);
    if (customer?.phone) doc.text(`Telefon: ${customer.phone}`, 20, 77);
    if (customer?.email) doc.text(`Email: ${customer.email}`, 20, 84);
    
    // Komercijalista - naslov
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("Komercijalista:", 120, 55);
    
    // Komercijalista - ime (isti font kao ostali podaci)
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.text(`${user?.fullName || "N/A"}`, 120, 63);
    
    // Tabela - zaglavlje
    let yPos = 100;
    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPos - 5, 180, 8, "F");
    
    doc.setFont("times", "bold");
    doc.setFontSize(9);
    doc.text("Artikal", 17, yPos);
    doc.text("Kol.", 72, yPos);
    doc.text("Cijena", 88, yPos);
    doc.text("Rabat", 112, yPos);
    doc.text("Bez PDV", 138, yPos);
    doc.text("Sa PDV", 170, yPos);
    
    doc.setFont("times", "normal");
    yPos += 8;
    
    let ukupnoSaPDV = 0;
    
    // VAŽNO: Cijene u bazi već UKLJUČUJU 17% PDV
    (offer.items || []).forEach((item: any) => {
      const price = parseFloat(item.price);
      const qty = item.quantity;
      const discount = parseFloat(item.discount || "0");
      const baseTotal = price * qty;
      const discountAmount = baseTotal * (discount / 100);
      const saPDV = baseTotal - discountAmount;
      const bezPDV = saPDV / (1 + PDV_RATE);
      
      ukupnoSaPDV += saPDV;
      
      const productName = item.productName || products.find((p) => p.id === item.productId)?.name || "N/A";
      
      // Razbij dugacak naziv u vise redova (max 28 karaktera po redu)
      doc.setFont("times", "normal");
      doc.setFontSize(9);
      
      const maxChars = 28;
      let nameLines: string[] = [];
      if (productName.length > maxChars) {
        let remaining = productName;
        while (remaining.length > 0) {
          if (remaining.length <= maxChars) {
            nameLines.push(remaining);
            break;
          }
          let breakPoint = remaining.lastIndexOf(" ", maxChars);
          if (breakPoint === -1) breakPoint = maxChars;
          nameLines.push(remaining.substring(0, breakPoint));
          remaining = remaining.substring(breakPoint).trim();
        }
      } else {
        nameLines = [productName];
      }
      
      // Prvi red sa svim podacima
      doc.text(nameLines[0], 17, yPos);
      doc.text(String(qty), 72, yPos);
      doc.text(`${price.toFixed(2)}`, 88, yPos);
      doc.text(`${discount.toFixed(0)}%`, 112, yPos);
      doc.text(`${bezPDV.toFixed(2)}`, 138, yPos);
      doc.text(`${saPDV.toFixed(2)}`, 170, yPos);
      
      // Dodatni redovi za dugacak naziv
      for (let i = 1; i < nameLines.length; i++) {
        yPos += 5;
        doc.text(nameLines[i], 17, yPos);
      }
      
      yPos += 6;
      
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
    });
    
    const ukupnoBezPDV = ukupnoSaPDV / (1 + PDV_RATE);
    const pdvIznos = ukupnoSaPDV - ukupnoBezPDV;
    
    // Linija iznad totala
    yPos += 5;
    doc.line(15, yPos, 195, yPos);
    yPos += 8;
    
    // Totali - poravnati sa kolonama
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text("Ukupno bez PDV:", 100, yPos);
    doc.text(`${ukupnoBezPDV.toFixed(2)} KM`, 170, yPos);
    
    yPos += 6;
    doc.text("PDV (17%):", 100, yPos);
    doc.text(`${pdvIznos.toFixed(2)} KM`, 170, yPos);
    
    yPos += 8;
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text("UKUPNO SA PDV:", 100, yPos);
    doc.text(`${ukupnoSaPDV.toFixed(2)} KM`, 170, yPos);
    
    doc.save(`Ponuda_${offer.id}_${customer?.name || "kupac"}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="heading-offers">Ponude</h1>
        <p className="text-muted-foreground">Kreiraj i upravljaj ponudama</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Kreiraj novu ponudu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 overflow-x-hidden px-2 sm:px-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Odaberi kupca</label>
                <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerSearchOpen}
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
                      <CommandInput placeholder="Pretrazi kupce..." data-testid="input-search-customer" />
                      <CommandList>
                        <CommandEmpty>Nema pronadenih kupaca.</CommandEmpty>
                        <CommandGroup heading="Kupci">
                          {customers.map((customer: any) => (
                            <CommandItem
                              key={customer.id}
                              value={`${customer.name} ${customer.company}`}
                              onSelect={() => {
                                setSelectedCustomer(String(customer.id));
                                setCustomerSearchOpen(false);
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
                        <CommandInput placeholder="Pretrazi proizvode..." data-testid="input-search-products" />
                        <CommandList>
                          <CommandEmpty>Nema pronadenih proizvoda.</CommandEmpty>
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
                    min="1"
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
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">Artikal</th>
                          <th className="text-center p-2 w-16">Kol.</th>
                          <th className="text-right p-2 w-20">Cijena</th>
                          <th className="text-center p-2 w-20">Rabat %</th>
                          <th className="text-right p-2 w-24">Bez PDV</th>
                          <th className="text-right p-2 w-24">Sa PDV</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {items.map((item, idx) => (
                          <tr key={idx} data-testid={`offer-item-${idx}`}>
                            <td className="p-2">
                              <p className="font-medium truncate max-w-[150px]">
                                {item.productName}
                              </p>
                            </td>
                            <td className="text-center p-2">{item.quantity}</td>
                            <td className="text-right p-2">{parseFloat(item.price).toFixed(2)}</td>
                            <td className="p-2">
                              <Input
                                type="number"
                                value={item.discount}
                                onChange={(e) => handleDiscountChange(idx, e.target.value)}
                                className="w-16 h-8 text-center"
                                min="0"
                                max="100"
                                data-testid={`input-discount-${idx}`}
                              />
                            </td>
                            <td className="text-right p-2 font-medium">
                              {calculateItemBezPDV(item).toFixed(2)}
                            </td>
                            <td className="text-right p-2 font-medium">
                              {calculateItemWithPDV(item).toFixed(2)}
                            </td>
                            <td className="p-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(idx)}
                                data-testid={`button-remove-item-${idx}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="bg-muted/30 rounded-md p-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Ukupno bez PDV:</span>
                      <span className="font-medium">{totalBezPDV.toFixed(2)} KM</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>PDV (17%):</span>
                      <span className="font-medium">{pdvIznos.toFixed(2)} KM</span>
                    </div>
                    <div className="flex justify-between text-base font-bold border-t pt-2">
                      <span>UKUPNO SA PDV:</span>
                      <span>{totalSaPDV.toFixed(2)} KM</span>
                    </div>
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => createOfferMutation.mutate()}
                disabled={!selectedCustomer || items.length === 0 || createOfferMutation.isPending}
                data-testid="button-create-offer"
              >
                <FileText className="h-4 w-4 mr-2" />
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
                {offers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nema kreiranih ponuda
                  </p>
                )}
                {offers.map((offer: any) => {
                  const customer = customers.find((c: any) => c.id === offer.customerId);
                  let offerTotalBezPDV = 0;
                  (offer.items || []).forEach((item: any) => {
                    const price = parseFloat(item.price);
                    const qty = item.quantity;
                    const discount = parseFloat(item.discount || "0");
                    const baseTotal = price * qty;
                    const discountAmount = baseTotal * (discount / 100);
                    offerTotalBezPDV += baseTotal - discountAmount;
                  });
                  const offerPDV = offerTotalBezPDV * PDV_RATE;
                  const offerTotalSaPDV = offerTotalBezPDV + offerPDV;
                  
                  return (
                    <div
                      key={offer.id}
                      className="border rounded-md p-3 text-sm"
                      data-testid={`offer-card-${offer.id}`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <p className="font-medium">{customer?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {offer.items?.length || 0} artikala | {format(new Date(offer.createdAt), "dd.MM.yyyy")}
                          </p>
                          <div className="mt-2 text-xs space-y-0.5">
                            <p>Bez PDV: <span className="font-medium">{offerTotalBezPDV.toFixed(2)} KM</span></p>
                            <p className="font-bold">Sa PDV: {offerTotalSaPDV.toFixed(2)} KM</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => generatePDF(offer)}
                            data-testid={`button-download-pdf-${offer.id}`}
                            title="Preuzmi PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteOfferMutation.mutate(offer.id)}
                            data-testid={`button-delete-offer-${offer.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
