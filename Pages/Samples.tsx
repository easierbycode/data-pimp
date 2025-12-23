import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Search, Filter, Grid3X3, List, Loader2 } from 'lucide-react';
import SampleCard from '../components/samples/SampleCard';
import { useTranslation } from '../components/i18n/translations';

export default function Samples() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [fireSaleOnly, setFireSaleOnly] = useState(false);
  const [viewMode, setViewMode] = useState('grid');

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ['samples'],
    queryFn: () => base44.entities.Sample.list('-created_date')
  });

  // Get unique brands and locations for filters
  const brands = useMemo(() => {
    const uniqueBrands = [...new Set(samples.map(s => s.brand).filter(Boolean))];
    return uniqueBrands.sort();
  }, [samples]);

  const locations = useMemo(() => {
    const uniqueLocations = [...new Set(samples.map(s => s.location).filter(Boolean))];
    return uniqueLocations.sort();
  }, [samples]);

  // Filter samples
  const filteredSamples = useMemo(() => {
    return samples.filter(sample => {
      const matchesSearch = !search || 
        sample.name?.toLowerCase().includes(search.toLowerCase()) ||
        sample.brand?.toLowerCase().includes(search.toLowerCase()) ||
        sample.qr_code?.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || sample.status === statusFilter;
      const matchesBrand = brandFilter === 'all' || sample.brand === brandFilter;
      const matchesLocation = locationFilter === 'all' || sample.location === locationFilter;
      const matchesFireSale = !fireSaleOnly || sample.fire_sale;

      return matchesSearch && matchesStatus && matchesBrand && matchesLocation && matchesFireSale;
    });
  }, [samples, search, statusFilter, brandFilter, locationFilter, fireSaleOnly]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{t('sample.titlePlural')}</h1>
              <p className="text-sm text-slate-500 mt-1">
                {filteredSamples.length} of {samples.length} samples
              </p>
            </div>
            <Link to={createPageUrl('SampleCreate')}>
              <Button className="bg-slate-900 hover:bg-slate-800">
                <Plus className="w-4 h-4 mr-2" />
                {t('sample.createNew')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('filters.searchPlaceholder')}
                className="pl-10"
              />
            </div>

            {/* Filter dropdowns */}
            <div className="flex flex-wrap gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={t('filters.allStatuses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
                  <SelectItem value="available">{t('status.available')}</SelectItem>
                  <SelectItem value="checked_out">{t('status.checked_out')}</SelectItem>
                  <SelectItem value="reserved">{t('status.reserved')}</SelectItem>
                  <SelectItem value="discontinued">{t('status.discontinued')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={t('filters.allBrands')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allBrands')}</SelectItem>
                  {brands.map(brand => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={t('filters.allLocations')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allLocations')}</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-lg border border-orange-200">
                <Switch
                  id="fire-sale"
                  checked={fireSaleOnly}
                  onCheckedChange={setFireSaleOnly}
                />
                <Label htmlFor="fire-sale" className="text-sm font-medium text-orange-700 cursor-pointer">
                  🔥 {t('filters.fireSaleOnly')}
                </Label>
              </div>

              {/* View toggle */}
              <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sample Grid/List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : filteredSamples.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Filter className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">{t('messages.noResults')}</h3>
            <p className="text-slate-500">Try adjusting your filters</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSamples.map(sample => (
              <SampleCard key={sample.id} sample={sample} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSamples.map(sample => (
              <Link key={sample.id} to={createPageUrl(`SampleDetails?id=${sample.id}`)}>
                <SampleCard sample={sample} compact />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}