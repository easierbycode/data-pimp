import React from "react";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ExternalLink, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl, hasLowestPrice } from "@/utils";
import StatusBadge from "../ui/StatusBadge.tsx";
import FireSaleBadge from "../ui/FireSaleBadge.tsx";
import LowestPriceOnlineBadge from "../ui/LowestPriceOnlineBadge.tsx";
import QRCodeDisplay from "../ui/QRCodeDisplay.tsx";
import type { Sample } from "@/api/base44Client.ts";

export default function SampleCard({ sample, compact = false }) {
  const defaultImage = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop';
  
  if (compact) {
    return (
      <div className="flex items-center gap-4 p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
        <img
          src={sample.picture_url || defaultImage}
          alt={sample.name}
          className="w-12 h-12 rounded-lg object-cover"
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 truncate">{sample.name}</p>
          <p className="text-sm text-slate-500">{sample.brand}</p>
        </div>
        <StatusBadge status={sample.status} />
        {sample.fire_sale && <FireSaleBadge />}
        {hasLowestPrice(sample) && <LowestPriceOnlineBadge />}
      </div>
    );
  }
  
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-square relative bg-slate-100">
        <img
          src={sample.picture_url || defaultImage}
          alt={sample.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <StatusBadge status={sample.status} />
          {sample.fire_sale && <FireSaleBadge />}
          {hasLowestPrice(sample) && <LowestPriceOnlineBadge />}
        </div>
        {sample.bundle_id && (
          <div className="absolute top-3 right-3">
            <div className="bg-white/90 backdrop-blur-sm rounded-full p-2">
              <Package className="w-4 h-4 text-slate-600" />
            </div>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <div className="mb-2">
          <h3 className="font-semibold text-slate-900 truncate">{sample.name}</h3>
          <p className="text-sm text-slate-500">{sample.brand}</p>
        </div>
        
        <div className="flex items-center justify-between mb-3">
          {sample.current_price !== null && sample.current_price !== undefined && (
            <span className="font-bold text-lg">${Number(sample.current_price).toFixed(2)}</span>
          )}
          {sample.location && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
              {sample.location}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Link to={createPageUrl(`SampleDetails?id=${sample.id}`)} className="flex-1">
            <Button variant="outline" className="w-full" size="sm">
              View Details
            </Button>
          </Link>
          {sample.tiktok_affiliate_link && (
            <a href={sample.tiktok_affiliate_link} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}