import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowLeft, Edit, Trash2, Package, MapPin, Calendar, 
  User, ExternalLink, Loader2, AlertTriangle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import StatusBadge from '../components/ui/StatusBadge';
import FireSaleBadge from '../components/ui/FireSaleBadge';
import QRCodeDisplay from '../components/ui/QRCodeDisplay';
import PriceDisplay from '../components/ui/PriceDisplay';
import { useTranslation } from '../components/i18n/translations';

export default function SampleDetails() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const sampleId = urlParams.get('id');

  const { data: sample, isLoading } = useQuery({
    queryKey: ['sample', sampleId],
    queryFn: async () => {
      const samples = await base44.entities.Sample.filter({ id: sampleId });
      return samples[0];
    },
    enabled: !!sampleId
  });

  const { data: bundle } = useQuery({
    queryKey: ['bundle', sample?.bundle_id],
    queryFn: async () => {
      if (!sample?.bundle_id) return null;
      const bundles = await base44.entities.Bundle.filter({ id: sample.bundle_id });
      return bundles[0];
    },
    enabled: !!sample?.bundle_id
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', sampleId],
    queryFn: () => base44.entities.InventoryTransaction.filter({ sample_id: sampleId }, '-created_date', 10),
    enabled: !!sampleId
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Sample.delete(sampleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      navigate(createPageUrl('Samples'));
    }
  });

  const defaultImage = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!sample) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('sample.notFound')}</h2>
          <Link to={createPageUrl('Samples')}>
            <Button variant="outline">{t('actions.back')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('Samples')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
              <ArrowLeft className="w-4 h-4" />
              <span>{t('sample.titlePlural')}</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link to={createPageUrl(`SampleEdit?id=${sample.id}`)}>
                <Button variant="outline" size="sm">
                  <Edit className="w-4 h-4 mr-2" />
                  {t('actions.edit')}
                </Button>
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('actions.delete')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('sample.deleteSample')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('sample.deleteConfirm')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => deleteMutation.mutate()}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {t('actions.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Card */}
            <Card className="overflow-hidden">
              <div className="md:flex">
                <div className="md:w-1/3">
                  <div className="aspect-square relative">
                    <img 
                      src={sample.picture_url || defaultImage}
                      alt={sample.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                      <StatusBadge status={sample.status} />
                      {sample.fire_sale && <FireSaleBadge />}
                    </div>
                  </div>
                </div>
                <CardContent className="p-6 md:w-2/3">
                  <h1 className="text-2xl font-bold text-slate-900 mb-1">{sample.name}</h1>
                  <p className="text-lg text-slate-500 mb-4">{sample.brand}</p>
                  
                  <div className="mb-4">
                    <QRCodeDisplay code={sample.qr_code} />
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm">
                    {sample.location && (
                      <div className="flex items-center gap-1 text-slate-600">
                        <MapPin className="w-4 h-4" />
                        {sample.location}
                      </div>
                    )}
                    {bundle && (
                      <Link 
                        to={createPageUrl(`BundleDetails?id=${bundle.id}`)}
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                      >
                        <Package className="w-4 h-4" />
                        {bundle.name}
                      </Link>
                    )}
                  </div>
                </CardContent>
              </div>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent>
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
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    TikTok Affiliate Link <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {sample.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('sample.notes')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 whitespace-pre-wrap">{sample.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Checkout Status */}
            <Card>
              <CardHeader>
                <CardTitle>Checkout Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sample.checked_out_to && (
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-500">{t('sample.checkedOutTo')}</p>
                      <p className="font-medium">{sample.checked_out_to}</p>
                    </div>
                  </div>
                )}
                {sample.checked_out_at && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-500">{t('sample.checkedOutAt')}</p>
                      <p className="font-medium">{formatDate(sample.checked_out_at)}</p>
                    </div>
                  </div>
                )}
                {sample.checked_in_at && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-500">{t('sample.checkedInAt')}</p>
                      <p className="font-medium">{formatDate(sample.checked_in_at)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No activity yet</p>
                ) : (
                  <div className="space-y-3">
                    {transactions.map(tx => (
                      <div key={tx.id} className="flex items-start gap-3 text-sm">
                        <div className={`
                          w-2 h-2 rounded-full mt-1.5 flex-shrink-0
                          ${tx.action === 'checkout' ? 'bg-amber-500' : 
                            tx.action === 'checkin' ? 'bg-emerald-500' : 'bg-blue-500'}
                        `} />
                        <div>
                          <p className="font-medium capitalize">{tx.action}</p>
                          <p className="text-slate-500">
                            {formatDate(tx.created_date)}
                            {tx.operator && ` by ${tx.operator}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}