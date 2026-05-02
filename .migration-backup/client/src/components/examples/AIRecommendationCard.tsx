import { AIRecommendationCard } from "../AIRecommendationCard";

export default function AIRecommendationCardExample() {
  return (
    <AIRecommendationCard
      id="1"
      customerName="Amra Softić"
      customerCompany="Hotel Bristol"
      suggestedProducts={["VORAX GT 5kg", "Suma Grill D9"]}
      reasoning="Klijent redovno naručuje proizvode za čišćenje kuhinje svakih 30 dana. Vrijeme je za ponovno naručivanje."
      priority="high"
      optimalTime="10:00 - 12:00"
    />
  );
}
