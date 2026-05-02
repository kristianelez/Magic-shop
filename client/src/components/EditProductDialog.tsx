import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { insertProductSchema, type Product, type ProductSize } from "@shared/schema";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const formSchema = insertProductSchema;
type FormData = z.infer<typeof formSchema>;

interface EditProductDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Lokalni red u editoru veličina. id postoji samo za već postojeće veličine;
// nove tek treba kreirati pa se id dodjeljuje na backendu.
interface SizeRow {
  id?: number;
  name: string;
  stock: number | string;
}

export function EditProductDialog({ product, open, onOpenChange }: EditProductDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const canEditSizes = user?.role === "admin" || user?.role === "sales_director";

  // Lokalni state liste veličina (uključuje i nove redove dok se ne sačuvaju).
  const [sizeRows, setSizeRows] = useState<SizeRow[]>([]);

  // Učitaj postojeće veličine sa servera kad se dialog otvori.
  const { data: serverSizes = [] } = useQuery<ProductSize[]>({
    queryKey: ["/api/products", product.id, "sizes"],
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setSizeRows(
        serverSizes.map((s) => ({ id: s.id, name: s.name, stock: s.stock })),
      );
    }
  }, [open, serverSizes]);

  // Sumirano stanje iz veličina — ako artikal ima veličine, glavni "stock"
  // postaje read-only i automatski se računa iz pojedinačnih lagera.
  const hasSizes = sizeRows.length > 0;
  const sizesStockSum = sizeRows.reduce((sum, s) => {
    const n = typeof s.stock === "string" ? parseInt(s.stock) || 0 : s.stock;
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
      vendor: product.vendor ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: product.name,
        category: product.category,
        price: product.price,
        stock: product.stock,
        unit: product.unit,
        vendor: product.vendor ?? "",
      });
    }
  }, [open, product, form]);

  const updateProduct = useMutation({
    mutationFn: async (data: FormData) => {
      // Kad postoje veličine, ukupan stock je automatski zbir, da legacy
      // listinzi (gdje se gleda samo product.stock) ostanu konzistentni.
      const payload = hasSizes ? { ...data, stock: sizesStockSum } : data;
      await apiRequest("PATCH", `/api/products/${product.id}`, payload);

      // Spremi i veličine ako ih korisnik smije editovati. Šaljemo samo
      // valjane redove (ne-prazno ime); stock se kastuje u broj.
      if (canEditSizes) {
        const sanitized = sizeRows
          .map((s) => ({
            id: s.id,
            name: (s.name ?? "").trim(),
            stock:
              typeof s.stock === "string"
                ? parseInt(s.stock) || 0
                : s.stock || 0,
          }))
          .filter((s) => s.name.length > 0);
        await apiRequest("PUT", `/api/products/${product.id}/sizes`, {
          sizes: sanitized,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/products", product.id, "sizes"],
      });
      toast({
        title: "Sačuvano",
        description: "Artikal je uspješno izmijenjen",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message || "Nije moguće izmijeniti artikal",
        variant: "destructive",
      });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/products/${product.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Obrisano",
        description: "Artikal je uklonjen iz kataloga",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message || "Nije moguće obrisati artikal",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    // Provjera duplikata naziva veličina (case-insensitive) — server isto
    // vrati grešku, ali lakše je korisniku odmah pokazati lokalno.
    if (canEditSizes && hasSizes) {
      const seen = new Set<string>();
      for (const s of sizeRows) {
        const key = (s.name ?? "").trim().toLowerCase();
        if (!key) {
          toast({
            title: "Greška",
            description: "Naziv veličine ne smije biti prazan",
            variant: "destructive",
          });
          return;
        }
        if (seen.has(key)) {
          toast({
            title: "Greška",
            description: `Naziv veličine "${s.name}" se ponavlja`,
            variant: "destructive",
          });
          return;
        }
        seen.add(key);
      }
    }
    updateProduct.mutate(data);
  };

  const addSizeRow = () => {
    setSizeRows([...sizeRows, { name: "", stock: 0 }]);
  };

  const updateSizeRow = (index: number, field: "name" | "stock", value: string) => {
    const next = [...sizeRows];
    if (field === "name") {
      next[index].name = value;
    } else {
      next[index].stock = value === "" ? "" : parseInt(value);
    }
    setSizeRows(next);
  };

  const removeSizeRow = (index: number) => {
    setSizeRows(sizeRows.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Izmijeni artikal</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Naziv proizvoda</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-product-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategorija</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-product-category" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cijena (KM)</FormLabel>
                    <FormControl>
                      <Input type="text" {...field} data-testid="input-edit-product-price" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Ukupno stanje
                      {hasSizes && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (zbir veličina)
                        </span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === "" ? 0 : parseInt(val, 10));
                        }}
                        value={hasSizes ? sizesStockSum : (field.value ?? "")}
                        readOnly={hasSizes}
                        className={hasSizes ? "bg-muted" : ""}
                        data-testid="input-edit-product-stock"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jedinica mjere</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-product-unit" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Šifra (vendor)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} data-testid="input-edit-product-vendor" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Sekcija veličina — samo admin / sales_director smije
                dodavati, mijenjati ili uklanjati veličine. Komercijalisti
                vide zaključanu listu samo za pregled. */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-semibold">Veličine i lager po veličini</Label>
                {canEditSizes && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSizeRow}
                    data-testid="button-add-size"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Dodaj veličinu
                  </Button>
                )}
              </div>
              {sizeRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nema definisanih veličina. {canEditSizes
                    ? 'Klikni "Dodaj veličinu" ako želiš pratiti lager po veličini (npr. S/M/L).'
                    : "Lager se vodi kao jedinstveno stanje."}
                </p>
              ) : (
                <div className="space-y-2">
                  {sizeRows.map((s, idx) => (
                    <div
                      key={s.id ?? `new-${idx}`}
                      className="flex items-end gap-2"
                      data-testid={`size-row-${idx}`}
                    >
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Naziv</Label>
                        <Input
                          value={s.name}
                          onChange={(e) => updateSizeRow(idx, "name", e.target.value)}
                          placeholder="npr. S, M, L, XL, 42, 44…"
                          disabled={!canEditSizes}
                          data-testid={`input-size-name-${idx}`}
                        />
                      </div>
                      <div className="w-24">
                        <Label className="text-xs text-muted-foreground">Stanje</Label>
                        <Input
                          type="number"
                          min="0"
                          value={s.stock}
                          onChange={(e) => updateSizeRow(idx, "stock", e.target.value)}
                          disabled={!canEditSizes}
                          data-testid={`input-size-stock-${idx}`}
                        />
                      </div>
                      {canEditSizes && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSizeRow(idx)}
                          aria-label="Ukloni veličinu"
                          data-testid={`button-remove-size-${idx}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground">
                    Veličine koje su već korištene u prodajama ne mogu biti
                    obrisane — biće im samo postavljen stock na 0 da istorija
                    ostane sačuvana.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (confirm(`Obrisati artikal "${product.name}"? Ova radnja se ne može poništiti.`)) {
                    deleteProduct.mutate();
                  }
                }}
                disabled={deleteProduct.isPending || updateProduct.isPending}
                data-testid="button-delete-product"
              >
                {deleteProduct.isPending ? "Brišem..." : "Obriši"}
              </Button>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-cancel-edit-product"
                >
                  Otkaži
                </Button>
                <Button
                  type="submit"
                  disabled={updateProduct.isPending}
                  data-testid="button-save-edit-product"
                >
                  {updateProduct.isPending ? "Čuvam..." : "Sačuvaj"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
