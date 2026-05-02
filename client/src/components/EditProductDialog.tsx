import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, type Product } from "@shared/schema";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const formSchema = insertProductSchema;
type FormData = z.infer<typeof formSchema>;

interface EditProductDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProductDialog({ product, open, onOpenChange }: EditProductDialogProps) {
  const { toast } = useToast();

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
      return await apiRequest("PATCH", `/api/products/${product.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
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
    updateProduct.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
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
                    <FormLabel>Stanje</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === "" ? 0 : parseInt(val, 10));
                        }}
                        value={field.value ?? ""}
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
