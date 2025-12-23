import React from "react";
import { base44 } from "@/api/base44Client.ts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import SampleForm from "../Components/samples/SampleForm.tsx";
import { useTranslation } from "../Components/i18n/translations.tsx";

export default function SampleEdit() {
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

  const { data: bundles = [] } = useQuery({
    queryKey: ['bundles'],
    queryFn: () => base44.entities.Bundle.list()
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Sample.update(sampleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      queryClient.invalidateQueries({ queryKey: ['sample', sampleId] });
      navigate(createPageUrl(`SampleDetails?id=${sampleId}`));
    }
  });

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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to={createPageUrl(`SampleDetails?id=${sampleId}`)} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Sample</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-4">{t('sample.editSample')}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SampleForm 
          sample={sample}
          bundles={bundles}
          onSave={(data) => updateMutation.mutate(data)}
          onCancel={() => navigate(createPageUrl(`SampleDetails?id=${sampleId}`))}
        />
      </div>
    </div>
  );
}