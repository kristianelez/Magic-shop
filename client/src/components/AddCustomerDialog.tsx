import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCustomerSchema, customerTypes, type Customer } from "@shared/schema";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const formSchema = insertCustomerSchema.extend({
  status: z.enum(["active", "inactive", "vip", "potential"]).default("active"),
  customerType: z.enum(customerTypes).default("ostalo"),
});

type FormData = z.infer<typeof formSchema>;

interface CustomerDialogProps {
  customer?: Customer;
  trigger?: React.ReactNode;
}

export function AddCustomerDialog({ customer, trigger }: CustomerDialogProps) {
  const [open, setOpen] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const { toast } = useToast();
  const isEditMode = !!customer;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: customer?.name || "",
      company: customer?.company || "",
      email: customer?.email || "",
      phone: customer?.phone || "",
      status: (customer?.status as "active" | "inactive" | "vip" | "potential") || "active",
      customerType: (customer?.customerType as typeof customerTypes[number]) || "ostalo",
      paymentTerms: customer?.paymentTerms || "",
    },
  });

  useEffect(() => {
    if (customer && open) {
      form.reset({
        name: customer.name,
        company: customer.company,
        email: customer.email || "",
        phone: customer.phone || "",
        status: customer.status as "active" | "inactive" | "vip" | "potential",
        customerType: (customer.customerType as typeof customerTypes[number]) || "ostalo",
        paymentTerms: customer.paymentTerms || "",
      });
    }
  }, [customer, open, form]);

  const saveCustomer = useMutation({
    mutationFn: async (data: FormData) => {
      if (isEditMode && customer) {
        return await apiRequest("PATCH", `/api/customers/${customer.id}`, data);
      } else {
        return await apiRequest("POST", "/api/customers", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: isEditMode ? "Uspješno ažurirano" : "Uspješno dodato",
        description: isEditMode ? "Kupac je ažuriran" : "Novi kupac je dodat u sistem",
      });
      setOpen(false);
      if (!isEditMode) {
        form.reset();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message || (isEditMode ? "Nije moguće ažurirati kupca" : "Nije moguće dodati kupca"),
        variant: "destructive",
      });
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Uspješno obrisano",
        description: "Kupac je trajno obrisan iz sistema",
      });
      setOpen(false);
      setShowDeleteAlert(false);
    },
    onError: (error: any) => {
      toast({
        title: "Greška",
        description: error.message || "Nije moguće obrisati kupca",
        variant: "destructive",
      });
      setShowDeleteAlert(false);
    },
  });

  const onSubmit = (data: FormData) => {
    saveCustomer.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button data-testid="button-add-customer">
            <Plus className="h-4 w-4 mr-2" />
            Novi kupac
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Uredi kupca" : "Dodaj novog kupca"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ime i prezime</FormLabel>
                  <FormControl>
                    <Input placeholder="Amra Softić" {...field} data-testid="input-customer-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kompanija</FormLabel>
                  <FormControl>
                    <Input placeholder="Hotel Bristol" {...field} data-testid="input-customer-company" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@example.ba" {...field} data-testid="input-customer-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefon</FormLabel>
                  <FormControl>
                    <Input placeholder="+387 33 123 456" {...field} data-testid="input-customer-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customerType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tip kupca</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-customer-type">
                        <SelectValue placeholder="Odaberi tip kupca" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="hotel">Hotel</SelectItem>
                      <SelectItem value="pekara">Pekara</SelectItem>
                      <SelectItem value="kafic">Kafić</SelectItem>
                      <SelectItem value="restoran">Restoran</SelectItem>
                      <SelectItem value="fabrika">Fabrika</SelectItem>
                      <SelectItem value="ostalo">Ostalo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-customer-status">
                        <SelectValue placeholder="Odaberi status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Aktivan</SelectItem>
                      <SelectItem value="inactive">Neaktivan</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                      <SelectItem value="potential">Potencijalni</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentTerms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dogovoreno plaćanje</FormLabel>
                  <FormControl>
                    <Input placeholder="Gotovinsko, 30 dana, itd." {...field} data-testid="input-payment-terms" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between gap-3">
              {isEditMode && customer && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteAlert(true)}
                  disabled={deleteCustomer.isPending}
                  data-testid="button-delete-customer"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Obriši
                </Button>
              )}
              <div className="flex gap-3 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  data-testid="button-cancel-customer"
                >
                  Otkaži
                </Button>
                <Button type="submit" disabled={saveCustomer.isPending} data-testid="button-save-customer">
                  {saveCustomer.isPending 
                    ? (isEditMode ? "Ažuriram..." : "Dodajem...") 
                    : (isEditMode ? "Sačuvaj izmjene" : "Dodaj kupca")
                  }
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potvrda brisanja</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite obrisati kupca <strong>{customer?.name}</strong>? 
              Ova akcija je trajna i ne može se poništiti. Svi podaci vezani za ovog kupca će biti trajno obrisani.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Otkaži</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => customer && deleteCustomer.mutate(customer.id)}
              disabled={deleteCustomer.isPending}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCustomer.isPending ? "Brišem..." : "Obriši kupca"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
