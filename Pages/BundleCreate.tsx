import React from "react";
import { base44 } from "@/api/base44Client.ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft } from "lucide-react";
import BundleForm from "../Components/bundles/BundleForm.tsx";
import { useTranslation } from "../Components/i18n/translations.tsx";

export default function BundleCreate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Bundle.create(data),
    onSuccess: (newBundle) => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] });
      navigate(createPageUrl(`BundleDetails?id=${newBundle.id}`));
    }
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to={createPageUrl('Bundles')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" />
            <span>{t('bundle.titlePlural')}</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-4">{t('bundle.createNew')}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BundleForm 
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => navigate(createPageUrl('Bundles'))}
        />
      </div>
    </div>
  );
}