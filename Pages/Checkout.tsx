import React, { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client.ts";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card.tsx";
import { QrCode } from "lucide-react";
import ScannerInput from "../Components/checkout/ScannerInput.tsx";
import ScanResult from "../Components/checkout/ScanResult.tsx";
import RecentScans from "../Components/checkout/RecentScans.tsx";
import { useTranslation } from "../Components/i18n/translations.tsx";

export default function Checkout() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [scanResult, setScanResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [recentScans, setRecentScans] = useState([]);

  const addRecentScan = (scan) => {
    setRecentScans(prev => [scan, ...prev].slice(0, 10));
  };

  const handleScan = useCallback(async (code) => {
    setProcessing(true);
    setScanResult(null);

    try {
      // First try to find a sample with this code
      const samples = await base44.entities.Sample.filter({ qr_code: code });
      
      if (samples.length > 0) {
        const sample = samples[0];
        setScanResult({ type: 'sample', data: sample });
        addRecentScan({
          code,
          type: 'sample',
          name: sample.name,
          timestamp: new Date().toISOString(),
          success: true
        });
        setProcessing(false);
        return;
      }

      // Then try to find a bundle
      const bundles = await base44.entities.Bundle.filter({ qr_code: code });
      
      if (bundles.length > 0) {
        const bundle = bundles[0];
        const bundleSamples = await base44.entities.Sample.filter({ bundle_id: bundle.id });
        setScanResult({ 
          type: 'bundle', 
          data: { bundle, samples: bundleSamples } 
        });
        addRecentScan({
          code,
          type: 'bundle',
          name: bundle.name,
          timestamp: new Date().toISOString(),
          success: true
        });
        setProcessing(false);
        return;
      }

      // Not found
      setScanResult({ type: 'not_found', data: { code } });
      addRecentScan({
        code,
        type: 'not_found',
        timestamp: new Date().toISOString(),
        success: false
      });
    } catch (error) {
      console.error('Scan error:', error);
      setScanResult({ type: 'not_found', data: { code } });
      addRecentScan({
        code,
        type: 'not_found',
        timestamp: new Date().toISOString(),
        success: false
      });
    }
    
    setProcessing(false);
  }, []);

  const handleCheckout = async (item, checkedOutTo, samples = null) => {
    setProcessing(true);
    const now = new Date().toISOString();

    try {
      if (samples) {
        // Bundle checkout - checkout all provided samples
        for (const sample of samples) {
          await base44.entities.Sample.update(sample.id, {
            status: 'checked_out',
            checked_out_at: now,
            checked_out_to: checkedOutTo || null
          });
          await base44.entities.InventoryTransaction.create({
            action: 'checkout',
            sample_id: sample.id,
            bundle_id: item.id,
            scanned_code: item.qr_code,
            operator: checkedOutTo || null,
            checked_out_to: checkedOutTo || null
          });
        }
        addRecentScan({
          code: item.qr_code,
          type: 'bundle',
          name: item.name,
          action: 'checkout',
          timestamp: now,
          success: true
        });
      } else {
        // Single sample checkout
        await base44.entities.Sample.update(item.id, {
          status: 'checked_out',
          checked_out_at: now,
          checked_out_to: checkedOutTo || null
        });
        await base44.entities.InventoryTransaction.create({
          action: 'checkout',
          sample_id: item.id,
          scanned_code: item.qr_code,
          operator: checkedOutTo || null,
          checked_out_to: checkedOutTo || null
        });
        addRecentScan({
          code: item.qr_code,
          type: 'sample',
          name: item.name,
          action: 'checkout',
          timestamp: now,
          success: true
        });
      }

      // Refresh the scan result
      await handleScan(samples ? item.qr_code : item.qr_code);
      queryClient.invalidateQueries({ queryKey: ['samples'] });
    } catch (error) {
      console.error('Checkout error:', error);
    }
    
    setProcessing(false);
  };

  const handleCheckin = async (item, checkedOutTo, samples = null) => {
    setProcessing(true);
    const now = new Date().toISOString();

    try {
      if (samples) {
        // Bundle checkin
        for (const sample of samples) {
          await base44.entities.Sample.update(sample.id, {
            status: 'available',
            checked_in_at: now,
            checked_out_to: null
          });
          await base44.entities.InventoryTransaction.create({
            action: 'checkin',
            sample_id: sample.id,
            bundle_id: item.id,
            scanned_code: item.qr_code,
            operator: checkedOutTo || null
          });
        }
        addRecentScan({
          code: item.qr_code,
          type: 'bundle',
          name: item.name,
          action: 'checkin',
          timestamp: now,
          success: true
        });
      } else {
        // Single sample checkin
        await base44.entities.Sample.update(item.id, {
          status: 'available',
          checked_in_at: now,
          checked_out_to: null
        });
        await base44.entities.InventoryTransaction.create({
          action: 'checkin',
          sample_id: item.id,
          scanned_code: item.qr_code,
          operator: checkedOutTo || null
        });
        addRecentScan({
          code: item.qr_code,
          type: 'sample',
          name: item.name,
          action: 'checkin',
          timestamp: now,
          success: true
        });
      }

      await handleScan(samples ? item.qr_code : item.qr_code);
      queryClient.invalidateQueries({ queryKey: ['samples'] });
    } catch (error) {
      console.error('Checkin error:', error);
    }
    
    setProcessing(false);
  };

  const handleReserve = async (sample, action, operator) => {
    setProcessing(true);
    const now = new Date().toISOString();

    try {
      const newStatus = action === 'reserve' ? 'reserved' : 'available';
      await base44.entities.Sample.update(sample.id, { status: newStatus });
      await base44.entities.InventoryTransaction.create({
        action: action,
        sample_id: sample.id,
        scanned_code: sample.qr_code,
        operator: operator || null
      });
      
      addRecentScan({
        code: sample.qr_code,
        type: 'sample',
        name: sample.name,
        action: action,
        timestamp: now,
        success: true
      });

      await handleScan(sample.qr_code);
      queryClient.invalidateQueries({ queryKey: ['samples'] });
    } catch (error) {
      console.error('Reserve error:', error);
    }
    
    setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">{t('checkout.title')}</h1>
            <p className="text-slate-500 mt-2">{t('checkout.scanPrompt')}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Scanner */}
        <Card className="p-6 mb-6 bg-white/80 backdrop-blur-sm">
          <ScannerInput onScan={handleScan} disabled={processing} />
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Scan Result */}
          <div className="lg:col-span-2">
            {scanResult && (
              <ScanResult
                type={scanResult.type}
                data={scanResult.data}
                onCheckout={handleCheckout}
                onCheckin={handleCheckin}
                onReserve={handleReserve}
                processing={processing}
              />
            )}
            
            {!scanResult && !processing && (
              <Card className="p-12 text-center bg-white/50">
                <QrCode className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Scan a QR code or barcode to see item details</p>
              </Card>
            )}
          </div>

          {/* Recent Scans */}
          <div>
            <RecentScans scans={recentScans} />
          </div>
        </div>
      </div>
    </div>
  );
}