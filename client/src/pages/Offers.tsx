import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [productSearchOpen, setProductSearchOpen] = useState<{ [key: number]: boolean }>({});
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
    if (sortedProducts.length > 0) {
      const firstProduct = sortedProducts[0];
      const newItem: OfferItem = {
        productId: firstProduct.id,
        quantity: 1,
        price: firstProduct.price,
        discount: "0",
        category: firstProduct.category,
        productName: firstProduct.name,
      };
      setItems([...items, newItem]);
      setProductSearchOpen({});
    }
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
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="heading-offers">Ponude</h1>
        <p className="text-muted-foreground">Kreiraj i upravljaj ponudama</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 overflow-x-hidden">
        <div className="lg:col-span-2 overflow-x-hidden">
          <div className="space-y-6 overflow-x-hidden">
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
                        {selectedCustomer
                          ? customers.find((c) => String(c.id) === selectedCustomer)?.name + " - " + customers.find((c) => String(c.id) === selectedCustomer)?.company
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
                                <span>{customer.name} - {customer.company}</span>
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
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>Proizvodi</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  data-testid="button-add-item"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj proizvod
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 overflow-hidden px-2 sm:px-6">
                {items.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
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
                              open={productSearchOpen && productSearchOpen[idx] || false}
                              onOpenChange={(open) => setProductSearchOpen({ ...productSearchOpen, [idx]: open })}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={productSearchOpen && productSearchOpen[idx] || false}
                                  className="w-full justify-between truncate"
                                  data-testid={`select-product-${idx}`}
                                >
                                  <span className="truncate">{item.productName}</span>
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
                                        {sortedProducts.slice(0, 10).map((product: any) => (
                                          <CommandItem
                                            key={product.id}
                                            value={product.name}
                                            onSelect={() => {
                                              const newItems = [...items];
                                              newItems[idx] = {
                                                ...newItems[idx],
                                                productId: product.id,
                                                productName: product.name,
                                                price: product.price,
                                                category: product.category,
                                              };
                                              setItems(newItems);
                                              setProductSearchOpen({ ...productSearchOpen, [idx]: false });
                                            }}
                                            data-testid={`product-option-${idx}-${product.id}`}
                                          >
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
                                      {sortedProducts.map((product: any) => (
                                        <CommandItem
                                          key={product.id}
                                          value={product.name}
                                          onSelect={() => {
                                            const newItems = [...items];
                                            newItems[idx] = {
                                              ...newItems[idx],
                                              productId: product.id,
                                              productName: product.name,
                                              price: product.price,
                                              category: product.category,
                                            };
                                            setItems(newItems);
                                            setProductSearchOpen({ ...productSearchOpen, [idx]: false });
                                          }}
                                          data-testid={`all-products-option-${idx}-${product.id}`}
                                        >
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
                              value={item.quantity}
                              onChange={(e) => {
                                const newItems = [...items];
                                newItems[idx].quantity = parseInt(e.target.value) || 1;
                                setItems(newItems);
                              }}
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

            <div className="flex flex-col gap-3">
              <Button
                className="w-full"
                onClick={() => createOfferMutation.mutate()}
                disabled={!selectedCustomer || items.length === 0 || createOfferMutation.isPending}
                data-testid="button-create-offer"
              >
                <FileText className="h-4 w-4 mr-2" />
                {createOfferMutation.isPending ? "Kreiram..." : "Kreiraj ponudu"}
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden">
          <Card>
            <CardHeader>
              <CardTitle>Ponude ({offers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-hidden">
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
