import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Package, LogIn, LogOut, Bookmark, ExternalLink, 
  MapPin, AlertCircle, CheckCircle, Loader2 
} from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import FireSaleBadge from '../ui/FireSaleBadge';
import QRCodeDisplay from '../ui/QRCodeDisplay';
import PriceDisplay from '../ui/PriceDisplay';
import { useTranslation } from '../i18n/translations';

export default function ScanResult({ 
  type, // 'sample' | 'bundle' | 'not_found'
  data, // sample or { bundle, samples }
  onCheckout,
  onCheckin,
  onReserve,
  processing = false
}) {
  const { t } = useTranslation();
  const [checkoutTo, setCheckoutTo] = useState('');
  
  const defaultImage = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop';

  if (type === 'not_found') {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-red-900 mb-2">{t('checkout.notFound')}</h3>
          <p className="text-red-700">{t('checkout.notFoundDesc')}</p>
        </CardContent>
      </Card>
    );
  }

  if (type === 'sample') {
    const sample = data;
    const canCheckout = sample.status === 'available' || sample.status === 'reserved';
    const canCheckin = sample.status === 'checked_out';
    const canReserve = sample.status === 'available';
    const canUnreserve = sample.status === 'reserved';

    return (
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <span className="font-medium text-slate-700">{t('checkout.sampleFound')}</span>
          </div>
          <StatusBadge status={sample.status} />
        </div>
        
        <CardContent className="p-6">
          <div className="flex gap-6">
            <img 
              src={sample.picture_url || defaultImage}
              alt={sample.name}
              className="w-32 h-32 rounded-xl object-cover flex-shrink-0"
            />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{sample.name}</h2>
                  <p className="text-lg text-slate-500">{sample.brand}</p>
                </div>
                {sample.fire_sale && <FireSaleBadge />}
              </div>
              
              <div className="flex flex-wrap gap-4 mb-4">
                {sample.location && (
                  <div className="flex items-center gap-1 text-sm text-slate-500">
                    <MapPin className="w-4 h-4" />
                    {sample.location}
                  </div>
                )}
                {sample.bundle_id && (
                  <div className="flex items-center gap-1 text-sm text-indigo-600">
                    <Package className="w-4 h-4" />
                    In Bundle
                  </div>
                )}
              </div>
              
              <div className="mb-4">
                <QRCodeDisplay code={sample.qr_code} />
              </div>
              
              <PriceDisplay 
                currentPrice={sample.current_price}
                bestPrice={sample.best_price}
                bestPriceSource={sample.best_price_source}
                lastChecked={sample.last_price_checked_at}
              />
              
              {sample.tiktok_affiliate_link && (
                <a 
                  href={sample.tiktok_affiliate_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  TikTok Link <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
          
          {/* Checkout Actions */}
          <div className="mt-6 pt-6 border-t">
            {(canCheckout || canCheckin) && (
              <div className="mb-4">
                <Label htmlFor="checkout_to" className="text-sm text-slate-600">
                  {t('checkout.checkoutTo')}
                </Label>
                <Input
                  id="checkout_to"
                  value={checkoutTo}
                  onChange={(e) => setCheckoutTo(e.target.value)}
                  placeholder={t('checkout.checkoutToPlaceholder')}
                  className="mt-1 max-w-md"
                />
              </div>
            )}
            
            <div className="flex flex-wrap gap-3">
              {canCheckout && (
                <Button 
                  size="lg"
                  onClick={() => onCheckout(sample, checkoutTo)}
                  disabled={processing}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
                  {t('actions.checkout')}
                </Button>
              )}
              
              {canCheckin && (
                <Button 
                  size="lg"
                  onClick={() => onCheckin(sample, checkoutTo)}
                  disabled={processing}
                  className="bg-emerald-500 hover:bg-emerald-600"
                >
                  {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                  {t('actions.checkin')}
                </Button>
              )}
              
              {canReserve && (
                <Button 
                  size="lg"
                  variant="outline"
                  onClick={() => onReserve(sample, 'reserve', checkoutTo)}
                  disabled={processing}
                >
                  <Bookmark className="w-4 h-4 mr-2" />
                  {t('actions.reserve')}
                </Button>
              )}
              
              {canUnreserve && (
                <Button 
                  size="lg"
                  variant="outline"
                  onClick={() => onReserve(sample, 'unreserve', checkoutTo)}
                  disabled={processing}
                >
                  <Bookmark className="w-4 h-4 mr-2" />
                  {t('actions.unreserve')}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (type === 'bundle') {
    const { bundle, samples } = data;
    const availableSamples = samples.filter(s => s.status === 'available' || s.status === 'reserved');
    const checkedOutSamples = samples.filter(s => s.status === 'checked_out');

    return (
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-500" />
            <span className="font-medium text-slate-700">{t('checkout.bundleFound')}</span>
          </div>
          <span className="text-sm text-slate-500">{samples.length} samples</span>
        </div>
        
        <CardContent className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900">{bundle.name}</h2>
              {bundle.location && (
                <div className="flex items-center gap-1 text-slate-500 mt-1">
                  <MapPin className="w-4 h-4" />
                  {bundle.location}
                </div>
              )}
              <div className="mt-2">
                <QRCodeDisplay code={bundle.qr_code} />
              </div>
            </div>
          </div>
          
          {bundle.notes && (
            <p className="text-slate-600 mb-6 p-4 bg-slate-50 rounded-lg">{bundle.notes}</p>
          )}
          
          {/* Bundle Checkout Actions */}
          <div className="mb-6 pt-4 border-t">
            <div className="mb-4">
              <Label htmlFor="bundle_checkout_to" className="text-sm text-slate-600">
                {t('checkout.checkoutTo')}
              </Label>
              <Input
                id="bundle_checkout_to"
                value={checkoutTo}
                onChange={(e) => setCheckoutTo(e.target.value)}
                placeholder={t('checkout.checkoutToPlaceholder')}
                className="mt-1 max-w-md"
              />
            </div>
            
            <div className="flex flex-wrap gap-3">
              {availableSamples.length > 0 && (
                <Button 
                  size="lg"
                  onClick={() => onCheckout(bundle, checkoutTo, availableSamples)}
                  disabled={processing}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
                  Check Out {availableSamples.length} Samples
                </Button>
              )}
              
              {checkedOutSamples.length > 0 && (
                <Button 
                  size="lg"
                  onClick={() => onCheckin(bundle, checkoutTo, checkedOutSamples)}
                  disabled={processing}
                  className="bg-emerald-500 hover:bg-emerald-600"
                >
                  {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                  Check In {checkedOutSamples.length} Samples
                </Button>
              )}
            </div>
          </div>
          
          {/* Sample List */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">{t('checkout.allSamples')}</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {samples.map(sample => (
                <div 
                  key={sample.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                >
                  <img 
                    src={sample.picture_url || defaultImage}
                    alt={sample.name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{sample.name}</p>
                    <p className="text-sm text-slate-500">{sample.brand}</p>
                  </div>
                  <StatusBadge status={sample.status} />
                  {sample.fire_sale && <FireSaleBadge />}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}