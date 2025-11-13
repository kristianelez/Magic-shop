import { CustomerCard } from "@/components/CustomerCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Filter } from "lucide-react";
import { useState } from "react";

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("");

  //todo: remove mock functionality
  const customers = [
    {
      id: "1",
      name: "Amra Softić",
      company: "Hotel Bristol",
      lastContact: "Prije 2 dana",
      totalPurchases: 45600,
      status: "vip" as const,
      favoriteProducts: ["VORAX GT 5kg", "Suma Grill D9"],
    },
    {
      id: "2",
      name: "Edin Jusić",
      company: "Bolnica Koševo",
      lastContact: "Prije 5 dana",
      totalPurchases: 32800,
      status: "active" as const,
      favoriteProducts: ["BACTER WC 5L", "Higi Glass Cleaner"],
    },
    {
      id: "3",
      name: "Selma Imamović",
      company: "Restoran Kod Muje",
      lastContact: "Prije 1 sedmicu",
      totalPurchases: 18900,
      status: "active" as const,
      favoriteProducts: ["Higi Dish Soap", "Domestos gel"],
    },
    {
      id: "4",
      name: "Nermin Hodžić",
      company: "Ćevabdžinica Željo",
      lastContact: "Prije 2 sedmice",
      totalPurchases: 12400,
      status: "active" as const,
      favoriteProducts: ["Suma Grill D9", "CIF Cream"],
    },
    {
      id: "5",
      name: "Lejla Karić",
      company: "Škola Štampar Makarije",
      lastContact: "Prije 3 sedmice",
      totalPurchases: 8700,
      status: "inactive" as const,
      favoriteProducts: ["TASKI Jontec 300"],
    },
    {
      id: "6",
      name: "Haris Begić",
      company: "Tržni centar BBI",
      lastContact: "Juče",
      totalPurchases: 52300,
      status: "vip" as const,
      favoriteProducts: ["VORAX GT 5kg", "BACTER WC 5L", "Higi Glass Cleaner"],
    },
  ];

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-customers">Kupci</h1>
          <p className="text-muted-foreground">Upravljajte vašim klijentima</p>
        </div>
        <Button data-testid="button-add-customer">
          <Plus className="h-4 w-4 mr-2" />
          Novi kupac
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pretraži kupce..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-customers"
          />
        </div>
        <Button variant="outline" data-testid="button-filter">
          <Filter className="h-4 w-4 mr-2" />
          Filteri
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCustomers.map((customer) => (
          <CustomerCard key={customer.id} {...customer} />
        ))}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nema kupaca koji odgovaraju pretrazi</p>
        </div>
      )}
    </div>
  );
}
