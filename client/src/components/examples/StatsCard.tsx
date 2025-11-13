import { StatsCard } from "../StatsCard";
import { Users } from "lucide-react";

export default function StatsCardExample() {
  return (
    <StatsCard
      title="Ukupno kupaca"
      value="142"
      icon={Users}
      trend={{ value: 12, isPositive: true }}
    />
  );
}
