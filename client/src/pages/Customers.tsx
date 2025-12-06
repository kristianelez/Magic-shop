import { CustomerCard } from "@/components/CustomerCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AddCustomerDialog } from "@/components/AddCustomerDialog";
import type { Customer } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CustomerWithStats extends Customer {
  totalPurchases: number;
  lastContact?: string;
  favoriteProducts: string[];
}

type SortOption = "lastContact" | "lastContactNewest" | "name" | "nameReverse" | "status" | "type";

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("lastContactNewest");

  const { data: customers = [], isLoading } = useQuery<CustomerWithStats[]>({
    queryKey: ["/api/customers"],
  });

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort customers based on selected option
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    switch (sortBy) {
      case "lastContact": {
        // Sort by lastContact - oldest first
        const dateA = a.lastContact ? new Date(a.lastContact).getTime() : 0;
        const dateB = b.lastContact ? new Date(b.lastContact).getTime() : 0;
        return dateA - dateB; // Oldest first
      }
      case "lastContactNewest": {
        // Sort by lastContact - newest first
        const dateA = a.lastContact ? new Date(a.lastContact).getTime() : 0;
        const dateB = b.lastContact ? new Date(b.lastContact).getTime() : 0;
        return dateB - dateA; // Newest first
      }
      case "name":
        return a.name.localeCompare(b.name, "bs");
      case "nameReverse":
        return b.name.localeCompare(a.name, "bs");
      case "status": {
        const statusOrder = { vip: 0, active: 1, potential: 2, inactive: 3 };
        return (statusOrder[a.status as keyof typeof statusOrder] || 99) -
               (statusOrder[b.status as keyof typeof statusOrder] || 99);
      }
      case "type":
        return (a.customerType || "").localeCompare(b.customerType || "", "bs");
      default:
        return 0;
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Učitavam...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-customers">Kupci</h1>
          <p className="text-muted-foreground">Upravljajte vašim klijentima</p>
        </div>
        <AddCustomerDialog />
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" data-testid="button-filter">
              <Filter className="h-4 w-4 mr-2" />
              Sortiraj
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setSortBy("lastContactNewest")}
              data-testid="sort-lastContactNewest"
              className={sortBy === "lastContactNewest" ? "bg-accent" : ""}
            >
              <span className={sortBy === "lastContactNewest" ? "font-semibold" : ""}>
                Zadnje kontaktirani (najnoviji)
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortBy("lastContact")}
              data-testid="sort-lastContact"
              className={sortBy === "lastContact" ? "bg-accent" : ""}
            >
              <span className={sortBy === "lastContact" ? "font-semibold" : ""}>
                Zadnje kontaktirani (od najstarijih)
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortBy("name")}
              data-testid="sort-name"
              className={sortBy === "name" ? "bg-accent" : ""}
            >
              <span className={sortBy === "name" ? "font-semibold" : ""}>
                Abecedno (A-Ž)
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortBy("nameReverse")}
              data-testid="sort-nameReverse"
              className={sortBy === "nameReverse" ? "bg-accent" : ""}
            >
              <span className={sortBy === "nameReverse" ? "font-semibold" : ""}>
                Abecedno (Ž-A)
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortBy("status")}
              data-testid="sort-status"
              className={sortBy === "status" ? "bg-accent" : ""}
            >
              <span className={sortBy === "status" ? "font-semibold" : ""}>
                Po statusu
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortBy("type")}
              data-testid="sort-type"
              className={sortBy === "type" ? "bg-accent" : ""}
            >
              <span className={sortBy === "type" ? "font-semibold" : ""}>
                Po tipu
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedCustomers.map((customer: any) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            lastContact={customer.lastContact}
            totalPurchases={customer.totalPurchases || 0}
            favoriteProducts={customer.favoriteProducts}
          />
        ))}
      </div>

      {sortedCustomers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nema kupaca koji odgovaraju pretrazi</p>
        </div>
      )}
    </div>
  );
}
