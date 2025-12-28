import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ShoppingCart, Package, Trash2, TrendingDown } from "lucide-react";
import StatusBadge from "../ui/StatusBadge.tsx";
import FireSaleBadge from "../ui/FireSaleBadge.tsx";
import LowestPriceOnlineBadge from "../ui/LowestPriceOnlineBadge.tsx";

interface CartItem {
  type: 'sample' | 'bundle';
  data: any;
  samples?: any[];
}

interface CartDisplayProps {
  items: CartItem[];
  onRemoveItem: (index: number) => void;
  onCheckout: () => void;
  onClearCart: () => void;
}

export default function CartDisplay({ items, onRemoveItem, onCheckout, onClearCart }: CartDisplayProps) {
  const defaultImage = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop';

  // Calculate if item has best price (current_price < best_price)
  const hasLowestPrice = (item: any) => {
    if (!item.current_price || !item.best_price) return false;
    return item.current_price < item.best_price;
  };

  // Calculate savings for an item
  const calculateSavings = (item: any) => {
    if (!item.current_price || !item.best_price) return 0;
    if (item.current_price >= item.best_price) return 0;
    return item.best_price - item.current_price;
  };

  // Calculate total savings across all cart items
  const totalSavings = items.reduce((total, cartItem) => {
    if (cartItem.type === 'sample') {
      return total + calculateSavings(cartItem.data);
    } else if (cartItem.type === 'bundle' && cartItem.samples) {
      return total + cartItem.samples.reduce((sum, sample) => sum + calculateSavings(sample), 0);
    }
    return total;
  }, 0);

  // Check if any item has savings
  const hasSavings = totalSavings > 0;

  if (items.length === 0) {
    return (
      <Card className="bg-white/50">
        <CardContent className="p-8 text-center">
          <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Your cart is empty</p>
          <p className="text-sm text-slate-400 mt-1">Scan items to add them to your cart</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white">
      <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
            Cart ({items.length} {items.length === 1 ? 'item' : 'items'})
          </CardTitle>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearCart}
              className="text-slate-600 hover:text-red-600"
            >
              Clear Cart
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* Cart Items */}
        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
          {items.map((cartItem, index) => {
            if (cartItem.type === 'sample') {
              const sample = cartItem.data;
              const savings = calculateSavings(sample);
              const hasLowest = hasLowestPrice(sample);

              return (
                <div key={index} className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <img
                    src={sample.picture_url || defaultImage}
                    alt={sample.name}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-slate-900 truncate">{sample.name}</h4>
                        <p className="text-sm text-slate-500">{sample.brand}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveItem(index)}
                        className="text-slate-400 hover:text-red-600 h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <StatusBadge status={sample.status} />
                      {sample.fire_sale && <FireSaleBadge />}
                      {hasLowest && <LowestPriceOnlineBadge />}
                    </div>
                    {sample.current_price && (
                      <div className="mt-2">
                        <span className="text-lg font-bold text-slate-900">
                          ${sample.current_price.toFixed(2)}
                        </span>
                        {savings > 0 && (
                          <span className="ml-2 text-sm text-emerald-600 font-semibold flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" />
                            Save ${savings.toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            } else if (cartItem.type === 'bundle') {
              const bundle = cartItem.data;
              const samples = cartItem.samples || [];
              const bundleSavings = samples.reduce((sum, s) => sum + calculateSavings(s), 0);

              return (
                <div key={index} className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-indigo-600" />
                      <h4 className="font-semibold text-slate-900">{bundle.name}</h4>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveItem(index)}
                      className="text-slate-400 hover:text-red-600 h-8 w-8 p-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{samples.length} samples</p>
                  {bundleSavings > 0 && (
                    <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                      <TrendingDown className="w-4 h-4" />
                      Bundle saves ${bundleSavings.toFixed(2)}
                    </div>
                  )}
                </div>
              );
            }
            return null;
          })}
        </div>

        {/* Savings Summary */}
        {hasSavings && (
          <div className="p-4 mb-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg border-2 border-emerald-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-emerald-600" />
                <span className="font-semibold text-emerald-900">Total Savings</span>
              </div>
              <span className="text-2xl font-bold text-emerald-600">
                ${totalSavings.toFixed(2)}
              </span>
            </div>
            <p className="text-sm text-emerald-700 mt-1">
              You're getting the lowest prices online!
            </p>
          </div>
        )}

        {/* Checkout Button */}
        <Button
          onClick={onCheckout}
          size="lg"
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold"
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          Checkout {items.length} {items.length === 1 ? 'Item' : 'Items'}
        </Button>
      </CardContent>
    </Card>
  );
}
