import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import BundleForm from '../components/bundles/BundleForm';
import { useTranslation } from '../components/i18n/translations';

export default function BundleEdit() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const bundleId = urlParams.get('id');

  const { data: bundle, isLoading } = useQuery({
    queryKey: ['bundle', bundleId],
    queryFn: async () => {
      const bundles = await base44.entities.Bundle.filter({ id: bundleId });
      return bundles[0];
    },
    enabled: !!bundleId
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Bundle.update(bundleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] });
      queryClient.invalidateQueries({ queryKey: ['bundle', bundleId] });
      navigate(createPageUrl(`BundleDetails?id=${bundleId}`));
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('bundle.notFound')}</h2>
          <Link to={createPageUrl('Bundles')}>
            <Button variant="outline">{t('actions.back')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to={createPageUrl(`BundleDetails?id=${bundleId}`)} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Bundle</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-4">{t('bundle.editBundle')}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BundleForm 
          bundle={bundle}
          onSave={(data) => updateMutation.mutate(data)}
          onCancel={() => navigate(createPageUrl(`BundleDetails?id=${bundleId}`))}
        />
      </div>
    </div>
  );
}