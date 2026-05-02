import { CustomerCard } from "../CustomerCard";

export default function CustomerCardExample() {
  return (
    <CustomerCard
      id="1"
      name="Amra Softić"
      company="Hotel Bristol"
      lastContact="Prije 2 dana"
      totalPurchases={45600}
      status="vip"
      favoriteProducts={["VORAX GT 5kg", "Suma Grill D9"]}
    />
  );
}
