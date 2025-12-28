import React from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { TrendingDown } from "lucide-react";

export default function LowestPriceOnlineBadge() {
  return (
    <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 gap-1">
      <TrendingDown className="w-3 h-3" />
      Lowest Price Online
    </Badge>
  );
}
