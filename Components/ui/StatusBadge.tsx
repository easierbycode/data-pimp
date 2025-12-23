import React from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { useTranslation } from "../i18n/translations.tsx";

const statusStyles = {
  available: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  checked_out: 'bg-amber-100 text-amber-800 border-amber-200',
  reserved: 'bg-blue-100 text-blue-800 border-blue-200',
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