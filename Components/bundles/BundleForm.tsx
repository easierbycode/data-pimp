import React, { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Loader2 } from "lucide-react";
import { useTranslation } from "../i18n/translations.tsx";
import type { Bundle } from "@/api/base44Client.ts";

export default function BundleForm({ bundle, onSave, onCancel }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: bundle?.name || '',
    location: bundle?.location || '',
    qr_code: bundle?.qr_code || '',
    notes: bundle?.notes || ''
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = t('messages.required');
    if (!formData.qr_code.trim()) newErrors.qr_code = t('messages.required');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bundle Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">{t('bundle.name')} *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className={errors.name ? 'border-red-500' : ''}
              placeholder="e.g., Summer Collection"
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="qr_code">{t('bundle.qrCode')} *</Label>
            <Input
              id="qr_code"
              value={formData.qr_code}
              onChange={(e) => setFormData(prev => ({ ...prev, qr_code: e.target.value }))}
              className={errors.qr_code ? 'border-red-500' : ''}
              placeholder="Enter unique bundle code"
            />
            {errors.qr_code && <p className="text-sm text-red-500">{errors.qr_code}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="location">{t('bundle.location')}</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="e.g., Storage Room B"
            />
          </div>
          
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="notes">{t('bundle.notes')}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Additional notes about this bundle..."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {t('actions.cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {t('actions.save')}
        </Button>
      </div>
    </form>
  );
}