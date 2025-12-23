QRCodeDisplayimport React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Copy, Check, QrCode } from 'lucide-react';
import { useTranslation } from '../i18n/translations';

export default function QRCodeDisplay({ code, showImage = false }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 font-mono text-sm">
        <QrCode className="w-4 h-4 text-slate-400" />
        <span className="select-all">{code}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className="h-8 w-8"
      >
        {copied ? (
          <Check className="w-4 h-4 text-emerald-500" />
        ) : (
          <Copy className="w-4 h-4 text-slate-400" />
        )}
      </Button>
    </div>
  );
}