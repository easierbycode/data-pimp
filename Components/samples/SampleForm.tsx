import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { base44 } from '@/api/base44Client';
import { Loader2, Upload, X } from 'lucide-react';
import { useTranslation } from '../i18n/translations';

export default function SampleForm({ sample, bundles = [], onSave, onCancel }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: sample?.name || '',
    brand: sample?.brand || '',
    location: sample?.location || '',
    qr_code: sample?.qr_code || '',
    picture_url: sample?.picture_url || '',
    tiktok_affiliate_link: sample?.tiktok_affiliate_link || '',
    fire_sale: sample?.fire_sale || false,
    status: sample?.status || 'available',
    current_price: sample?.current_price || '',
    best_price: sample?.best_price || '',
    best_price_source: sample?.best_price_source || '',
    bundle_id: sample?.bundle_id || '',
    notes: sample?.notes || ''
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = t('messages.required');
    if (!formData.brand.trim()) newErrors.brand = t('messages.required');
    if (!formData.qr_code.trim()) newErrors.qr_code = t('messages.required');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    setSaving(true);
    const dataToSave = {
      ...formData,
      current_price: formData.current_price ? Number(formData.current_price) : null,
      best_price: formData.best_price ? Number(formData.best_price) : null,
      bundle_id: formData.bundle_id || null
    };
    await onSave(dataToSave);
    setSaving(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, picture_url: file_url }));
    } catch (error) {
      console.error('Upload failed:', error);
    }
    setUploading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">{t('sample.name')} *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="brand">{t('sample.brand')} *</Label>
            <Input
              id="brand"
              value={formData.brand}
              onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
              className={errors.brand ? 'border-red-500' : ''}
            />
            {errors.brand && <p className="text-sm text-red-500">{errors.brand}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="qr_code">{t('sample.qrCode')} *</Label>
            <Input
              id="qr_code"
              value={formData.qr_code}
              onChange={(e) => setFormData(prev => ({ ...prev, qr_code: e.target.value }))}
              className={errors.qr_code ? 'border-red-500' : ''}
              placeholder="Enter unique code"
            />
            {errors.qr_code && <p className="text-sm text-red-500">{errors.qr_code}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="location">{t('sample.location')}</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="e.g., Shelf A-12"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status">{t('sample.status')}</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">{t('status.available')}</SelectItem>
                <SelectItem value="checked_out">{t('status.checked_out')}</SelectItem>
                <SelectItem value="reserved">{t('status.reserved')}</SelectItem>
                <SelectItem value="discontinued">{t('status.discontinued')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="bundle">{t('sample.bundle')}</Label>
            <Select 
              value={formData.bundle_id || 'none'} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, bundle_id: value === 'none' ? '' : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('sample.noBundle')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('sample.noBundle')}</SelectItem>
                {bundles.map(bundle => (
                  <SelectItem key={bundle.id} value={bundle.id}>{bundle.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Image</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            {formData.picture_url ? (
              <div className="relative">
                <img 
                  src={formData.picture_url} 
                  alt="Preview" 
                  className="w-32 h-32 object-cover rounded-lg"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={() => setFormData(prev => ({ ...prev, picture_url: '' }))}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 transition-colors">
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs text-slate-500">Upload</span>
                  </>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>
            )}
            <div className="flex-1 space-y-2">
              <Label htmlFor="picture_url">Or enter URL</Label>
              <Input
                id="picture_url"
                value={formData.picture_url}
                onChange={(e) => setFormData(prev => ({ ...prev, picture_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pricing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="current_price">{t('sample.currentPrice')}</Label>
            <Input
              id="current_price"
              type="number"
              step="0.01"
              min="0"
              value={formData.current_price}
              onChange={(e) => setFormData(prev => ({ ...prev, current_price: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="best_price">{t('sample.bestPrice')}</Label>
            <Input
              id="best_price"
              type="number"
              step="0.01"
              min="0"
              value={formData.best_price}
              onChange={(e) => setFormData(prev => ({ ...prev, best_price: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="best_price_source">{t('sample.bestPriceSource')}</Label>
            <Input
              id="best_price_source"
              value={formData.best_price_source}
              onChange={(e) => setFormData(prev => ({ ...prev, best_price_source: e.target.value }))}
              placeholder="https://..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Additional Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tiktok_link">{t('sample.tiktokLink')}</Label>
            <Input
              id="tiktok_link"
              value={formData.tiktok_affiliate_link}
              onChange={(e) => setFormData(prev => ({ ...prev, tiktok_affiliate_link: e.target.value }))}
              placeholder="https://tiktok.com/..."
            />
          </div>
          
          <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div>
              <Label htmlFor="fire_sale" className="text-base font-medium">{t('sample.fireSale')}</Label>
              <p className="text-sm text-slate-500">Mark this item for fire sale pricing</p>
            </div>
            <Switch
              id="fire_sale"
              checked={formData.fire_sale}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, fire_sale: checked }))}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">{t('sample.notes')}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Additional notes..."
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