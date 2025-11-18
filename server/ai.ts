// Hybrid AI system: Local algorithms (90%) + OpenAI (10%)
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
import OpenAI from "openai";
import { storage } from "./storage";
import { generateLocalRecommendations } from "./local-ai";
import { db } from "./db";
import { aiRecommendationsCache } from "@shared/schema";
import { desc } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface CustomerPurchasePattern {
  customerId: number;
  customerName: string;
  customerCompany: string;
  lastPurchaseDate: Date | null;
  averageDaysBetweenPurchases: number;
  daysSinceLastPurchase: number;
  favoriteProducts: string[];
  totalSpent: number;
}

interface AIRecommendation {
  customerId: number;
  customerName: string;
  customerCompany: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  suggestedProducts: string[];
  reasoning: string;
  priority: "high" | "medium" | "low";
  optimalContactTime: string;
}

export async function generateCustomerRecommendations(): Promise<AIRecommendation[]> {
  try {
    const customers = await storage.getCustomers();
    const allProducts = await storage.getProducts();
    
    const customerPatterns: CustomerPurchasePattern[] = [];

    for (const customer of customers) {
      const sales = await storage.getSalesByCustomer(customer.id);
      const stats = await storage.getCustomerStats(customer.id);

      if (sales.length === 0) continue;

      const sortedSales = sales.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const lastPurchaseDate = sortedSales[0]?.createdAt || null;
      const daysSinceLastPurchase = lastPurchaseDate 
        ? Math.floor((Date.now() - new Date(lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      let averageDaysBetweenPurchases = 30;
      if (sales.length > 1) {
        const purchaseDates = sales.map(s => new Date(s.createdAt).getTime());
        const intervals = [];
        for (let i = 0; i < purchaseDates.length - 1; i++) {
          intervals.push((purchaseDates[i] - purchaseDates[i + 1]) / (1000 * 60 * 60 * 24));
        }
        averageDaysBetweenPurchases = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      }

      customerPatterns.push({
        customerId: customer.id,
        customerName: customer.name,
        customerCompany: customer.company,
        lastPurchaseDate,
        averageDaysBetweenPurchases,
        daysSinceLastPurchase,
        favoriteProducts: stats.favoriteProducts,
        totalSpent: stats.totalPurchases,
      });
    }

    const patternsNeedingContact = customerPatterns.filter(
      p => p.daysSinceLastPurchase >= p.averageDaysBetweenPurchases * 0.8
    );

    if (patternsNeedingContact.length === 0) {
      return [];
    }

    const prompt = `Ti si prodajni asistent za kompaniju Greentime koja prodaje proizvode za čišćenje. 
Analiziraj sljedeće kupovne obrasce kupaca i generiši pametne preporuke kada ih kontaktirati i koje proizvode ponuditi.

KUPCI I NJIHOVI OBRASCI:
${patternsNeedingContact.map(p => `
- ${p.customerName} (${p.customerCompany})
  * Prosječno kupuje svakih ${Math.round(p.averageDaysBetweenPurchases)} dana
  * Zadnja kupovina: prije ${p.daysSinceLastPurchase} dana
  * Ukupno potrošeno: ${p.totalSpent.toFixed(2)} KM
  * Najčešći proizvodi: ${p.favoriteProducts.join(", ") || "nema podataka"}
`).join("\n")}

DOSTUPNI PROIZVODI:
${allProducts.slice(0, 15).map(p => `- ${p.name} (${p.category})`).join("\n")}

Za svakog kupca generiši preporuku u JSON formatu sa:
- customerId: broj
- suggestedProducts: niz stringova (maksimalno 3 proizvoda)
- reasoning: kratko objašnjenje zašto je vrijeme za kontakt (na bosanskom)
- priority: "high" (treba kontaktirati odmah), "medium" (uskoro), ili "low" (nije hitno)
- optimalContactTime: preporučeno vrijeme za poziv (npr. "10:00 - 12:00")

Vraćaj samo JSON niz objekata, bez dodatnog teksta.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "Ti si AI asistent koji analizira kupovne navike i generiše prodajne preporuke. Odgovaraj samo u JSON formatu.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    let aiRecommendations;

    try {
      const parsed = JSON.parse(content || "{}");
      aiRecommendations = parsed.recommendations || parsed.preporuke || [];
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return [];
    }

    const recommendations: AIRecommendation[] = [];
    
    for (const rec of aiRecommendations) {
      const pattern = patternsNeedingContact.find(p => p.customerId === rec.customerId);
      const customer = await storage.getCustomer(rec.customerId);
      
      recommendations.push({
        customerId: rec.customerId,
        customerName: pattern?.customerName || "",
        customerCompany: pattern?.customerCompany || "",
        customerEmail: customer?.email || null,
        customerPhone: customer?.phone || null,
        suggestedProducts: rec.suggestedProducts || [],
        reasoning: rec.reasoning || "",
        priority: rec.priority || "medium",
        optimalContactTime: rec.optimalContactTime || "10:00 - 16:00",
      });
    }

    return recommendations;
  } catch (error) {
    console.error("Error generating AI recommendations:", error);
    return [];
  }
}

const CACHE_VALIDITY_HOURS = 24;

async function getCachedOpenAIRecommendations(): Promise<AIRecommendation[] | null> {
  try {
    const cached = await db
      .select()
      .from(aiRecommendationsCache)
      .orderBy(desc(aiRecommendationsCache.createdAt))
      .limit(1);

    if (cached.length === 0) return null;

    const cacheAge = Date.now() - new Date(cached[0].createdAt).getTime();
    const maxAge = CACHE_VALIDITY_HOURS * 60 * 60 * 1000;

    if (cacheAge > maxAge) {
      await db.delete(aiRecommendationsCache);
      return null;
    }

    return JSON.parse(cached[0].recommendations);
  } catch (error) {
    console.error("Error reading cache:", error);
    return null;
  }
}

async function saveOpenAIRecommendationsToCache(recommendations: AIRecommendation[]): Promise<void> {
  try {
    await db.delete(aiRecommendationsCache);
    
    await db.insert(aiRecommendationsCache).values({
      recommendations: JSON.stringify(recommendations),
    });
  } catch (error) {
    console.error("Error saving to cache:", error);
  }
}

export async function generateHybridRecommendations(): Promise<AIRecommendation[]> {
  console.log("🤖 Generating hybrid AI recommendations...");

  const localRecs = await generateLocalRecommendations();
  console.log(`✅ Generated ${localRecs.length} local recommendations`);

  const cachedOpenAIRecs = await getCachedOpenAIRecommendations();

  if (cachedOpenAIRecs) {
    console.log(`📦 Using cached OpenAI recommendations (${cachedOpenAIRecs.length} items)`);

    const mergedRecs = [...localRecs];

    for (const openAIRec of cachedOpenAIRecs) {
      const exists = mergedRecs.find((r) => r.customerId === openAIRec.customerId);
      if (!exists && openAIRec.customerName && openAIRec.customerCompany) {
        mergedRecs.push({ ...openAIRec, localGenerated: false } as any);
      }
    }

    return mergedRecs.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  try {
    console.log("🔄 Cache expired, calling OpenAI for top 5 customers...");
    const openAIRecs = await generateCustomerRecommendations();
    
    if (openAIRecs.length > 0) {
      await saveOpenAIRecommendationsToCache(openAIRecs);
      console.log(`💾 Saved ${openAIRecs.length} OpenAI recommendations to cache`);
    }

    const mergedRecs = [...localRecs];

    for (const openAIRec of openAIRecs) {
      const exists = mergedRecs.find((r) => r.customerId === openAIRec.customerId);
      if (!exists && openAIRec.customerName && openAIRec.customerCompany) {
        mergedRecs.push({ ...openAIRec, localGenerated: false } as any);
      }
    }

    return mergedRecs.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  } catch (error) {
    console.error("❌ OpenAI error, using only local recommendations:", error);
    return localRecs;
  }
}
