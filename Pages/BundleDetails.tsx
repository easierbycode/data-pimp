import React, { useState } from "react";
import { base44 } from "@/api/base44Client.ts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import {
  ArrowLeft, Edit, Trash2, Package, MapPin, Plus, X,
  Loader2, AlertTriangle
} from "lucide-react";
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
} from "@/components/ui/alert-dialog.tsx";
import QRCodeDisplay from "../Components/ui/QRCodeDisplay.tsx";
import SampleCard from "../Components/samples/SampleCard.tsx";
import { useTranslation } from "../Components/i18n/translations.tsx";

export default function BundleDetails() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const bundleId = urlParams.get('id');
  const [selectedSampleToAdd, setSelectedSampleToAdd] = useState('');

  const { data: bundle, isLoading } = useQuery({
    queryKey: ['bundle', bundleId],
    queryFn: async () => {
      const bundles = await base44.entities.Bundle.filter({ id: bundleId });
      return bundles[0];
    },
    enabled: !!bundleId
  });

  const { data: bundleSamples = [] } = useQuery({
    queryKey: ['bundleSamples', bundleId],
    queryFn: () => base44.entities.Sample.filter({ bundle_id: bundleId }),
    enabled: !!bundleId
  });

  const { data: allSamples = [] } = useQuery({
    queryKey: ['samples'],
    queryFn: () => base44.entities.Sample.list()
  });

  // Samples not in this bundle
  const availableSamples = allSamples.filter(s => !s.bundle_id);

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Bundle.delete(bundleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] });
      navigate(createPageUrl('Bundles'));
    }
  });

  const addSampleMutation = useMutation({
    mutationFn: (sampleId) => base44.entities.Sample.update(sampleId, { 
      bundle_id: bundleId,
      location: bundle.location // Update location to match bundle
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundleSamples', bundleId] });
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      setSelectedSampleToAdd('');
    }
  });

  const removeSampleMutation = useMutation({
    mutationFn: (sampleId) => base44.entities.Sample.update(sampleId, { bundle_id: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundleSamples', bundleId] });
      queryClient.invalidateQueries({ queryKey: ['samples'] });
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('Bundles')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
              <ArrowLeft className="w-4 h-4" />
              <span>{t('bundle.titlePlural')}</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link to={createPageUrl(`BundleEdit?id=${bundle.id}`)}>
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
                    <AlertDialogTitle>{t('bundle.deleteBundle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('bundle.deleteConfirm')} This will remove all samples from this bundle but won't delete the samples themselves.
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
        {/* Bundle Info */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Package className="w-10 h-10 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">{bundle.name}</h1>
                
                <div className="flex flex-wrap gap-4 mb-4">
                  {bundle.location && (
                    <div className="flex items-center gap-1 text-slate-600">
                      <MapPin className="w-4 h-4" />
                      {bundle.location}
                    </div>
                  )}
                  <span className="text-slate-500">{bundleSamples.length} samples</span>
                </div>
                
                <QRCodeDisplay code={bundle.qr_code} />
                
                {bundle.notes && (
                  <p className="mt-4 text-slate-600 p-4 bg-slate-50 rounded-lg">{bundle.notes}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Samples Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('bundle.samples')}</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedSampleToAdd} onValueChange={setSelectedSampleToAdd}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select sample to add" />
                </SelectTrigger>
                <SelectContent>
                  {availableSamples.map(sample => (
                    <SelectItem key={sample.id} value={sample.id}>
                      {sample.name} ({sample.brand})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={() => addSampleMutation.mutate(selectedSampleToAdd)}
                disabled={!selectedSampleToAdd || addSampleMutation.isPending}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('bundle.addSample')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {bundleSamples.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">{t('bundle.noSamples')}</p>
                <p className="text-sm text-slate-400 mt-1">Add samples using the dropdown above</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bundleSamples.map(sample => (
                  <div key={sample.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <Link to={createPageUrl(`SampleDetails?id=${sample.id}`)}>
                        <SampleCard sample={sample} compact />
                      </Link>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSampleMutation.mutate(sample.id)}
                      disabled={removeSampleMutation.isPending}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}