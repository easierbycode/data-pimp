import React from "react";
import { ExternalLink } from "lucide-react";

export default function PriceDisplay({ currentPrice, bestPrice, bestPriceSource, lastChecked }) {
  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return `$${Number(price).toFixed(2)}`;
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-4">
        <div>
          <span className="text-sm text-slate-500">Current: </span>
          <span className="font-semibold text-lg">{formatPrice(currentPrice)}</span>
        </div>
        {bestPrice && (
          <div>
            <span className="text-sm text-slate-500">Best: </span>
            <span className="font-semibold text-emerald-600">{formatPrice(bestPrice)}</span>
          </div>
        )}
      </div>
      {bestPriceSource && (
        <a 
          href={bestPriceSource} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-[#4493f8] hover:text-[#4493f8]"
        >
          View source <ExternalLink className="w-3 h-3" />
        </a>
      )}
      {lastChecked && (
        <p className="text-xs text-slate-400">
          Last checked: {formatDate(lastChecked)}
        </p>
      )}
    </div>
  );
}