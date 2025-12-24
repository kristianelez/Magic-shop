import { storage } from "./storage";
import type { Customer, Product } from "@shared/schema";

interface SeasonalFactors {
  [category: string]: {
    [season: string]: number;
  };
}

const seasonalFactors: SeasonalFactors = {
  "Osvježivači": {
    ljeto: 1.3,
    zima: 0.8,
    proljeće: 1.1,
    jesen: 1.0,
  },
  "Sredstva za čišćenje": {
    ljeto: 0.9,
    zima: 1.2,
    proljeće: 1.3,
    jesen: 1.0,
  },
  "Dezinfekciona sredstva": {
    ljeto: 0.9,
    zima: 1.4,
    proljeće: 1.0,
    jesen: 1.1,
  },
  "WC sredstva": {
    ljeto: 1.0,
    zima: 1.1,
    proljeće: 1.2,
    jesen: 1.0,
  },
  "default": {
    ljeto: 1.0,
    zima: 1.0,
    proljeće: 1.0,
    jesen: 1.0,
  },
};

function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return "proljeće";
  if (month >= 6 && month <= 8) return "ljeto";
  if (month >= 9 && month <= 11) return "jesen";
  return "zima";
}

function getSeasonalFactor(category: string): number {
  const season = getCurrentSeason();
  const categoryFactors = seasonalFactors[category] || seasonalFactors["default"];
  return categoryFactors[season] || 1.0;
}

interface CustomerPurchasePattern {
  customerId: number;
  customerName: string;
  customerCompany: string;
  customerType: string | null;
  lastPurchaseDate: Date | null;
  averageDaysBetweenPurchases: number;
  daysSinceLastPurchase: number;
  favoriteProducts: string[];
  favoriteCategories: string[];
  totalSpent: number;
  averageOrderValue: number;
}

interface PredictedConsumption {
  productName: string;
  productCategory: string;
  estimatedDaysUntilEmpty: number;
  shouldReorder: boolean;
  confidence: number;
}

interface LocalRecommendation {
  customerId: number;
  customerName: string;
  customerCompany: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  suggestedProducts: string[];
  reasoning: string;
  priority: "high" | "medium" | "low";
  optimalContactTime: string;
  localGenerated: boolean;
}

async function analyzeCustomerPurchasePattern(
  customerId: number
): Promise<CustomerPurchasePattern | null> {
  const customer = await storage.getCustomer(customerId);
  if (!customer) return null;

  const sales = await storage.getSalesByCustomer(customerId);
  const stats = await storage.getCustomerStats(customerId);

  if (sales.length === 0) return null;

  const sortedSales = sales.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const lastPurchaseDate = sortedSales[0]?.createdAt || null;
  const daysSinceLastPurchase = lastPurchaseDate
    ? Math.floor((Date.now() - new Date(lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  let averageDaysBetweenPurchases = 30;
  if (sales.length > 1) {
    const purchaseDates = sales.map((s) => new Date(s.createdAt).getTime());
    const intervals = [];
    for (let i = 0; i < purchaseDates.length - 1; i++) {
      intervals.push((purchaseDates[i] - purchaseDates[i + 1]) / (1000 * 60 * 60 * 24));
    }
    averageDaysBetweenPurchases = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  const categoryMap = new Map<string, number>();
  for (const sale of sales) {
    const product = await storage.getProduct(sale.productId);
    if (product) {
      categoryMap.set(product.category, (categoryMap.get(product.category) || 0) + 1);
    }
  }

  const favoriteCategories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat)
    .slice(0, 3);

  const totalOrderValue = sales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount.toString()), 0);
  const averageOrderValue = totalOrderValue / sales.length;

  return {
    customerId,
    customerName: customer.name,
    customerCompany: customer.company,
    customerType: customer.customerType,
    lastPurchaseDate,
    averageDaysBetweenPurchases,
    daysSinceLastPurchase,
    favoriteProducts: stats.favoriteProducts,
    favoriteCategories,
    totalSpent: stats.totalPurchases,
    averageOrderValue,
  };
}

function predictProductConsumption(
  pattern: CustomerPurchasePattern,
  productName: string
): PredictedConsumption | null {
  const avgInterval = pattern.averageDaysBetweenPurchases;
  const daysSinceLast = pattern.daysSinceLastPurchase;

  const isFrequentProduct = pattern.favoriteProducts.includes(productName);

  if (!isFrequentProduct) return null;

  const estimatedDaysUntilEmpty = avgInterval - daysSinceLast;
  const shouldReorder = estimatedDaysUntilEmpty <= avgInterval * 0.2;

  const confidence = Math.min(pattern.favoriteProducts.length / 5, 1.0);

  return {
    productName,
    productCategory: "Unknown",
    estimatedDaysUntilEmpty: Math.max(0, estimatedDaysUntilEmpty),
    shouldReorder,
    confidence,
  };
}

function determinePriority(daysSinceLast: number, avgInterval: number): "high" | "medium" | "low" {
  const ratio = daysSinceLast / avgInterval;

  if (ratio >= 1.2) return "high";
  if (ratio >= 0.9) return "medium";
  return "low";
}

function getOptimalContactTime(customerType: string | null): string {
  const timeMap: Record<string, string> = {
    hotel: "09:00 - 11:00",
    restoran: "14:00 - 16:00",
    kafic: "10:00 - 12:00",
    pekara: "13:00 - 15:00",
    fabrika: "10:00 - 15:00",
    veseraj: "08:00 - 10:00",
    medicinska_ustanova: "09:00 - 11:00",
    autokozmetika: "09:00 - 12:00",
    ostalo: "10:00 - 16:00",
  };

  return timeMap[customerType || "ostalo"] || "10:00 - 16:00";
}

async function suggestProductsForCustomer(
  pattern: CustomerPurchasePattern
): Promise<{ products: string[]; reasoning: string }> {
  const allProducts = await storage.getProducts();

  const customerTypeProducts = pattern.customerType
    ? allProducts.filter(
        (p) =>
          p.recommendedFor &&
          p.recommendedFor.includes(pattern.customerType!)
      )
    : allProducts;

  const favoriteProductsToReorder = pattern.favoriteProducts.slice(0, 2);

  const season = getCurrentSeason();
  const seasonalProducts = customerTypeProducts
    .filter((p) => {
      const factor = getSeasonalFactor(p.category);
      return factor > 1.1;
    })
    .map((p) => p.name)
    .slice(0, 1);

  const categoryProducts = customerTypeProducts
    .filter((p) => pattern.favoriteCategories.includes(p.category))
    .filter((p) => !favoriteProductsToReorder.includes(p.name))
    .map((p) => p.name)
    .slice(0, 1);

  const suggestedProducts = Array.from(
    new Set([...favoriteProductsToReorder, ...seasonalProducts, ...categoryProducts])
  ).slice(0, 3);

  const reasons = [];
  
  if (pattern.daysSinceLastPurchase >= pattern.averageDaysBetweenPurchases) {
    reasons.push(
      `Kupac prosječno kupuje svakih ${Math.round(pattern.averageDaysBetweenPurchases)} dana`
    );
    reasons.push(
      `Zadnja kupovina je bila prije ${pattern.daysSinceLastPurchase} dana`
    );
  } else {
    const daysUntilExpected = Math.round(
      pattern.averageDaysBetweenPurchases - pattern.daysSinceLastPurchase
    );
    reasons.push(`Očekivana nova narudžba za ${daysUntilExpected} dana`);
  }

  if (seasonalProducts.length > 0) {
    reasons.push(`Trenutna sezona (${season}) povećava potražnju za ${seasonalProducts[0]}`);
  }

  const reasoning = reasons.join(". ") + ".";

  return {
    products: suggestedProducts,
    reasoning,
  };
}

let cachedAllProducts: Product[] | null = null;

async function getAllProductsCached(): Promise<Product[]> {
  if (!cachedAllProducts) {
    cachedAllProducts = await storage.getProducts();
  }
  return cachedAllProducts;
}

async function suggestProductsForCustomerOptimized(
  pattern: CustomerPurchasePattern,
  allProducts: Product[]
): Promise<{ products: string[]; reasoning: string }> {
  const customerTypeProducts = pattern.customerType
    ? allProducts.filter(
        (p) =>
          p.recommendedFor &&
          p.recommendedFor.includes(pattern.customerType!)
      )
    : allProducts;

  const favoriteProductsToReorder = pattern.favoriteProducts.slice(0, 2);

  const season = getCurrentSeason();
  const seasonalProducts = customerTypeProducts
    .filter((p) => {
      const factor = getSeasonalFactor(p.category);
      return factor > 1.1;
    })
    .map((p) => p.name)
    .slice(0, 1);

  const categoryProducts = customerTypeProducts
    .filter((p) => pattern.favoriteCategories.includes(p.category))
    .filter((p) => !favoriteProductsToReorder.includes(p.name))
    .map((p) => p.name)
    .slice(0, 1);

  const suggestedProducts = Array.from(
    new Set([...favoriteProductsToReorder, ...seasonalProducts, ...categoryProducts])
  ).slice(0, 3);

  const reasons = [];
  
  if (pattern.daysSinceLastPurchase >= pattern.averageDaysBetweenPurchases) {
    reasons.push(
      `Kupac prosječno kupuje svakih ${Math.round(pattern.averageDaysBetweenPurchases)} dana`
    );
    reasons.push(
      `Zadnja kupovina je bila prije ${pattern.daysSinceLastPurchase} dana`
    );
  } else {
    const daysUntilExpected = Math.round(
      pattern.averageDaysBetweenPurchases - pattern.daysSinceLastPurchase
    );
    reasons.push(`Očekivana nova narudžba za ${daysUntilExpected} dana`);
  }

  if (seasonalProducts.length > 0) {
    reasons.push(`Trenutna sezona (${season}) povećava potražnju za ${seasonalProducts[0]}`);
  }

  const reasoning = reasons.join(". ") + ".";

  return {
    products: suggestedProducts,
    reasoning,
  };
}

export async function generateLocalRecommendations(): Promise<LocalRecommendation[]> {
  const customers = await storage.getCustomers();
  const allProducts = await getAllProductsCached();
  const recommendations: LocalRecommendation[] = [];

  for (const customer of customers) {
    const pattern = await analyzeCustomerPurchasePattern(customer.id);

    if (!pattern) continue;

    const needsContact = pattern.daysSinceLastPurchase >= pattern.averageDaysBetweenPurchases * 0.8;

    if (!needsContact) continue;

    const { products, reasoning } = await suggestProductsForCustomerOptimized(pattern, allProducts);

    if (products.length === 0) continue;

    const priority = determinePriority(
      pattern.daysSinceLastPurchase,
      pattern.averageDaysBetweenPurchases
    );

    const customerData = await storage.getCustomer(pattern.customerId);
    
    recommendations.push({
      customerId: pattern.customerId,
      customerName: pattern.customerName,
      customerCompany: pattern.customerCompany,
      customerEmail: customerData?.email || null,
      customerPhone: customerData?.phone || null,
      suggestedProducts: products,
      reasoning,
      priority,
      optimalContactTime: getOptimalContactTime(pattern.customerType),
      localGenerated: true,
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}
