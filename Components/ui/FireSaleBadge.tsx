import React from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { Flame } from "lucide-react";

export default function FireSaleBadge() {
  return (
    <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 gap-1">
      <Flame className="w-3 h-3" />
      Fire Sale
    </Badge>
  );
}