import React from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { Flame } from "lucide-react";

export default function FireSaleBadge() {
  return (
    <Badge className="bg-primary/15 text-primary border-primary/30 gap-1">
      <Flame className="w-3 h-3" />
      Fire Sale
    </Badge>
  );
}