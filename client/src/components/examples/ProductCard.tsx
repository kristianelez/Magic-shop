import { ProductCard } from "../ProductCard";

export default function ProductCardExample() {
  return (
    <ProductCard
      product={{
        id: 1,
        name: "VORAX GT 5kg",
        category: "Sredstva za čišćenje",
        price: "89.90",
        stock: 45,
        unit: "kom",
        description: null,
        vendor: null,
        barcode: null,
        recommendedFor: null,
      }}
    />
  );
}
