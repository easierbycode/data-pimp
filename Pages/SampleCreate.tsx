import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft } from 'lucide-react';
import SampleForm from '../components/samples/SampleForm';
import { useTranslation } from '../components/i18n/translations';

export default function SampleCreate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: bundles = [] } = useQuery({
    queryKey: ['bundles'],
    queryFn: () => base44.entities.Bundle.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Sample.create(data),
    onSuccess: (newSample) => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      navigate(createPageUrl(`SampleDetails?id=${newSample.id}`));
    }
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to={createPageUrl('Samples')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" />
            <span>{t('sample.titlePlural')}</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-4">{t('sample.createNew')}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SampleForm 
          bundles={bundles}
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => navigate(createPageUrl('Samples'))}
        />
      </div>
    </div>
  );
}