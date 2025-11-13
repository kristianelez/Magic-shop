import { ProductCard } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus } from "lucide-react";
import { useState } from "react";

export default function Products() {
  const [searchQuery, setSearchQuery] = useState("");

  //todo: remove mock functionality
  const products = [
    { id: "1", name: "VORAX GT 5kg", category: "Sredstva za čišćenje", price: 89.90, stock: 45, unit: "kom" },
    { id: "2", name: "BACTER WC 5L", category: "Sredstva za čišćenje", price: 32.50, stock: 28, unit: "kom" },
    { id: "3", name: "Higi Glass Cleaner 4L", category: "Sredstva za čišćenje", price: 24.90, stock: 52, unit: "kom" },
    { id: "4", name: "IPC 24V CT15 B35 16L", category: "Oprema", price: 5690.00, stock: 3, unit: "kom" },
    { id: "5", name: "Suma Grill D9 2L", category: "Sredstva za čišćenje", price: 45.00, stock: 18, unit: "kom" },
    { id: "6", name: "TASKI Jontec 300 5L", category: "Sredstva za čišćenje", price: 67.50, stock: 31, unit: "kom" },
    { id: "7", name: "Higi Dish Soap 4L", category: "Sredstva za čišćenje", price: 28.90, stock: 42, unit: "kom" },
    { id: "8", name: "Air Wick Essential Oils", category: "Osvježivači", price: 7.40, stock: 65, unit: "kom" },
    { id: "9", name: "Aquarius Dispenser", category: "Dispenseri", price: 125.00, stock: 8, unit: "kom" },
  ];

  const categories = ["Svi proizvodi", "Sredstva za čišćenje", "Oprema", "Dispenseri", "Osvježivači"];

  const [activeCategory, setActiveCategory] = useState("Svi proizvodi");

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === "Svi proizvodi" || product.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-products">Proizvodi</h1>
          <p className="text-muted-foreground">Katalog Greentime proizvoda</p>
        </div>
        <Button data-testid="button-add-product">
          <Plus className="h-4 w-4 mr-2" />
          Novi proizvod
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pretraži proizvode..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="input-search-products"
        />
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="flex-wrap h-auto">
          {categories.map((category) => (
            <TabsTrigger key={category} value={category} data-testid={`tab-${category.toLowerCase()}`}>
              {category}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nema proizvoda koji odgovaraju pretrazi</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
