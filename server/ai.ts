// Using OpenAI's API for AI-powered customer recommendations
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
import OpenAI from "openai";
import { storage } from "./storage";

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

    const recommendations: AIRecommendation[] = aiRecommendations.map((rec: any) => {
      const pattern = patternsNeedingContact.find(p => p.customerId === rec.customerId);
      return {
        customerId: rec.customerId,
        customerName: pattern?.customerName || "",
        customerCompany: pattern?.customerCompany || "",
        suggestedProducts: rec.suggestedProducts || [],
        reasoning: rec.reasoning || "",
        priority: rec.priority || "medium",
        optimalContactTime: rec.optimalContactTime || "10:00 - 16:00",
      };
    });

    return recommendations;
  } catch (error) {
    console.error("Error generating AI recommendations:", error);
    return [];
  }
}
