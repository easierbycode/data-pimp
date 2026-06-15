import React from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { useTranslation } from "../i18n/translations.tsx";

// Per-status colors are local to this app (the shared list in
// core/sample-statuses.json carries only an abstract palette token). Keep a
// style for every data-pimp status value so none falls back and mislabels.
const statusStyles = {
  available: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  checked_out: 'bg-amber-100 text-amber-800 border-amber-200',
  reserved: 'bg-blue-100 text-blue-800 border-blue-200',
  cleared_to_sell: 'bg-green-100 text-green-800 border-green-200',
  discontinued: 'bg-slate-100 text-slate-800 border-slate-200'
};

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  
  return (
    <Badge 
      variant="outline" 
      className={`${statusStyles[status] || statusStyles.available} font-medium`}
    >
      {t(`status.${status}`)}
    </Badge>
  );
}