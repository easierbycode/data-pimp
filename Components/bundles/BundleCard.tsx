import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import QRCodeDisplay from '../ui/QRCodeDisplay';

export default function BundleCard({ bundle, sampleCount = 0 }) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-900">{bundle.name}</h3>
              {bundle.location && (
                <div className="flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="w-3 h-3" />
                  {bundle.location}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-slate-900">{sampleCount}</span>
            <p className="text-xs text-slate-500">samples</p>
          </div>
        </div>
        
        <div className="mb-4">
          <QRCodeDisplay code={bundle.qr_code} />
        </div>
        
        {bundle.notes && (
          <p className="text-sm text-slate-500 mb-4 line-clamp-2">{bundle.notes}</p>
        )}
        
        <Link to={createPageUrl(`BundleDetails?id=${bundle.id}`)}>
          <Button variant="outline" className="w-full">
            View Bundle
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}