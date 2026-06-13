import "./PageHeader.css";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

/** Port of `apps/web/modules/saas/shared/components/PageHeader.tsx`. */
export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div class="lp-page-header">
      <h2 class="lp-page-header__title">{title}</h2>
      {subtitle && <p class="lp-page-header__subtitle">{subtitle}</p>}
    </div>
  );
}
