import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { setPromotionSchema, type Product, type SetPromotionInput } from "@shared/schema";
import { format } from "date-fns";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface SetPromotionDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const toLocalInput = (d: Date | string | null | undefined) => {
  if (!d) return "";
  return format(new Date(d), "yyyy-MM-dd'T'HH:mm");
};

const defaultStart = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");
const defaultEnd = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return format(d, "yyyy-MM-dd'T'HH:mm");
};

export function SetPromotionDialog({ product, open, onOpenChange }: SetPromotionDialogProps) {
  const { toast } = useToast();
  const hasPromotion = !!product.promoPrice && !!product.promoStartDate && !!product.promoEndDate;

  const form = useForm<SetPromotionInput>({
    resolver: zodResolver(setPromotionSchema),
    defaultValues: {
      promoPrice: product.promoPrice ?? "",
      promoStartDate: toLocalInput(product.promoStartDate) || defaultStart(),
      promoEndDate: toLocalInput(product.promoEndDate) || defaultEnd(),
      promoNote: product.promoNote ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        promoPrice: product.promoPrice ?? "",
        promoStartDate: toLocalInput(product.promoStartDate) || defaultStart(),
        promoEndDate: toLocalInput(product.promoEndDate) || defaultEnd(),
        promoNote: product.promoNote ?? "",
      });
    }
  }, [open, product, form]);

  const setPromotion = useMutation({
    mutationFn: async (data: SetPromotionInput) => {
      const payload = {
        promoPrice: data.promoPrice,
        promoStartDate: new Date(data.promoStartDate).toISOString(),
        promoEndDate: new Date(data.promoEndDate).toISOString(),
        promoNote: data.promoNote || null,
      };
      return await apiRequest("POST", `/api/products/${product.id}/promotion`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/active-promotions"] });
      toast({ title: "Akcija postavljena", description: "Artikal je sada na akciji" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Greška",
        description: error.message || "Nije moguće postaviti akciju",
        variant: "destructive",
      });
    },
  });

  const removePromotion = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/products/${product.id}/promotion`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/active-promotions"] });
      toast({ title: "Akcija uklonjena", description: "Artikal više nije na akciji" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Greška",
        description: error.message || "Nije moguće ukloniti akciju",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SetPromotionInput) => {
    const promoPriceNum = parseFloat(data.promoPrice);
    const regularPriceNum = parseFloat(product.price);
    if (promoPriceNum >= regularPriceNum) {
      form.setError("promoPrice", {
        type: "manual",
        message: `Akcijska cijena mora biti manja od redovne (${product.price} KM)`,
      });
      return;
    }
    if (new Date(data.promoEndDate) <= new Date(data.promoStartDate)) {
      form.setError("promoEndDate", {
        type: "manual",
        message: "Datum kraja mora biti poslije datuma početka",
      });
      return;
    }
    setPromotion.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Postavi akciju</DialogTitle>
          <DialogDescription>
            {product.name} — redovna cijena: {parseFloat(product.price).toFixed(2)} KM
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="promoPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Akcijska cijena (KM)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...field}
                      value={field.value ?? ""}
                      data-testid="input-promo-price"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="promoStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datum početka</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        value={field.value ?? ""}
                        data-testid="input-promo-start"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="promoEndDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datum kraja</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        value={field.value ?? ""}
                        data-testid="input-promo-end"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="promoNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Napomena (opciono)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="npr. Ljetna akcija"
                      {...field}
                      value={field.value ?? ""}
                      data-testid="input-promo-note"
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-wrap justify-between gap-3 pt-2">
              {hasPromotion ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Ukloniti akciju s ovog artikla?")) {
                      removePromotion.mutate();
                    }
                  }}
                  disabled={setPromotion.isPending || removePromotion.isPending}
                  data-testid="button-remove-promotion"
                >
                  {removePromotion.isPending ? "Uklanjam..." : "Ukloni akciju"}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-cancel-promotion"
                >
                  Otkaži
                </Button>
                <Button
                  type="submit"
                  disabled={setPromotion.isPending || removePromotion.isPending}
                  data-testid="button-save-promotion"
                >
                  {setPromotion.isPending ? "Čuvam..." : hasPromotion ? "Ažuriraj akciju" : "Postavi akciju"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
