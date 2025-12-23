import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client.ts";
import type { Bundle, Sample } from "@/api/base44Client.ts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Plus, Search, Loader2, Package } from "lucide-react";
import BundleCard from "../Components/bundles/BundleCard.tsx";
import { useTranslation } from "../Components/i18n/translations.tsx";

export default function Bundles() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ['bundles'],
    queryFn: () => base44.entities.Bundle.list('-created_date')
  });

  const { data: samples = [] } = useQuery({
    queryKey: ['samples'],
    queryFn: () => base44.entities.Sample.list()
  });

  // Get sample counts per bundle
  const sampleCounts = useMemo(() => {
    const counts = {};
    samples.forEach(sample => {
      if (sample.bundle_id) {
        counts[sample.bundle_id] = (counts[sample.bundle_id] || 0) + 1;
      }
    });
    return counts;
  }, [samples]);

  // Filter bundles
  const filteredBundles = useMemo(() => {
    if (!search) return bundles;
    return bundles.filter(bundle =>
      bundle.name?.toLowerCase().includes(search.toLowerCase()) ||
      bundle.qr_code?.toLowerCase().includes(search.toLowerCase()) ||
      bundle.location?.toLowerCase().includes(search.toLowerCase())
    );
  }, [bundles, search]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{t('bundle.titlePlural')}</h1>
              <p className="text-sm text-slate-500 mt-1">
                {filteredBundles.length} bundles
              </p>
            </div>
            <Link to={createPageUrl('BundleCreate')}>
              <Button className="bg-slate-900 hover:bg-slate-800">
                <Plus className="w-4 h-4 mr-2" />
                {t('bundle.createNew')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bundles..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Bundle Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : filteredBundles.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              {bundles.length === 0 ? 'No bundles yet' : t('messages.noResults')}
            </h3>
            <p className="text-slate-500">
              {bundles.length === 0 ? 'Create your first bundle to group samples together' : 'Try adjusting your search'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBundles.map(bundle => (
              <BundleCard 
                key={bundle.id} 
                bundle={bundle} 
                sampleCount={sampleCounts[bundle.id] || 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}