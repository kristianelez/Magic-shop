import { unstable_cache } from "next/cache";
import { storage } from "@/lib/storage";
import { isPromotionActive } from "@workspace/db/schema";

// Products change rarely — cache 5 minutes, tag-invalidated on writes
export const getCachedProducts = unstable_cache(
  async () => {
    const products = await storage.getProducts();
    const now = new Date();
    return products.map((p) => ({ ...p, promoActive: isPromotionActive(p, now) }));
  },
  ["products-list"],
  { revalidate: 300, tags: ["products"] },
);

export const getCachedActivePromotions = unstable_cache(
  async () => {
    const products = await storage.getProducts();
    const now = new Date();
    return products.filter((p) => isPromotionActive(p, now)).map((p) => ({ ...p, promoActive: true as const }));
  },
  ["products-active-promotions"],
  { revalidate: 60, tags: ["products"] },
);
