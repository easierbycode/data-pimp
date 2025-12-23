import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Clock, Package, Box, XCircle, CheckCircle, AlertCircle } from "lucide-react";
import { useTranslation } from "../i18n/translations.tsx";

export default function RecentScans({ scans }) {
  const { t } = useTranslation();

  if (scans.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            {t('checkout.recentScans')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 text-center py-6">{t('checkout.noRecentScans')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          {t('checkout.recentScans')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {scans.map((scan, index) => (
            <div 
              key={index}
              className={`
                flex items-center gap-3 p-3 rounded-lg transition-colors
                ${scan.success ? 'bg-slate-50' : 'bg-red-50'}
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                ${scan.type === 'sample' ? 'bg-emerald-100' : scan.type === 'bundle' ? 'bg-indigo-100' : 'bg-red-100'}
              `}>
                {scan.type === 'sample' && <Box className="w-4 h-4 text-emerald-600" />}
                {scan.type === 'bundle' && <Package className="w-4 h-4 text-indigo-600" />}
                {scan.type === 'not_found' && <XCircle className="w-4 h-4 text-red-500" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-slate-900 truncate">
                  {scan.name || scan.code}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(scan.timestamp).toLocaleTimeString()}
                  {scan.action && (
                    <span className="ml-2">
                      • {scan.action === 'checkout' && '📤 Checked out'}
                      {scan.action === 'checkin' && '📥 Checked in'}
                      {scan.action === 'reserve' && '🔖 Reserved'}
                    </span>
                  )}
                </p>
              </div>
              
              {scan.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}