"use client";

import { ProductCard } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Tag } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { AddProductDialog } from "@/components/AddProductDialog";
import { useAuth } from "@/contexts/AuthContext";
import { isPromotionActive, type Product } from "@workspace/db/schema";

const PROMO_TAB = "Akcija";
const ALL_TAB = "Svi proizvodi";

export default function Products() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(ALL_TAB);
  const searchParamsObj = useSearchParams();
  const search = searchParamsObj.toString();
  const { user } = useAuth();

  const { data: products = [], isLoading } = useQuery<(Product & { promoActive?: boolean })[]>({
    queryKey: ["/api/products"],
  });

  // Sinhronizuj tab sa query parametrom (?category=akcija ↔ "Akcija" tab)
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("category") === "akcija") {
      setActiveCategory(PROMO_TAB);
    } else {
      setActiveCategory(ALL_TAB);
    }
  }, [search]);

  const promoProducts = useMemo(
    () => products.filter((p) => p.promoActive ?? isPromotionActive(p)),
    [products],
  );

  const baseCategories = Array.from(new Set(products.map((p) => p.category)));
  const categories = [PROMO_TAB, ALL_TAB, ...baseCategories];

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeCategory === PROMO_TAB) {
      const isPromo = product.promoActive ?? isPromotionActive(product);
      return isPromo && matchesSearch;
    }
    const matchesCategory =
      activeCategory === ALL_TAB || product.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Učitavam...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-products">Proizvodi</h1>
          <p className="text-muted-foreground">Katalog Magic Shop proizvoda</p>
        </div>
        {user?.role !== "sales_manager" && <AddProductDialog />}
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
            <TabsTrigger
              key={category}
              value={category}
              data-testid={`tab-${category.toLowerCase()}`}
              className={category === PROMO_TAB ? "data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground" : ""}
            >
              {category === PROMO_TAB && <Tag className="h-3 w-3 mr-1" />}
              {category}
              {category === PROMO_TAB && promoProducts.length > 0 && (
                <span className="ml-1.5 text-[10px] opacity-80">({promoProducts.length})</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {activeCategory === PROMO_TAB
                  ? "Trenutno nema aktivnih akcija"
                  : "Nema proizvoda koji odgovaraju pretrazi"}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
