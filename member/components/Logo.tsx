import "./Logo.css";
import { asset } from "fresh/runtime";

interface LogoProps {
  withLabel?: boolean;
  class?: string;
}

/**
 * Port of `apps/web/modules/shared/components/Logo.tsx`. Uses a static
 * `lp-logo.png` copied into `static/` (the original was served via `next/image`).
 */
export function Logo({ withLabel = true, class: className }: LogoProps) {
  return (
    <span class={["lp-logo", className].filter(Boolean).join(" ")}>
      <img
        src={asset("/lp-logo.png")}
        alt="LifePreneur"
        width={40}
        height={40}
        class="lp-logo__mark"
      />
      {withLabel && <span class="lp-logo__label">LifePreneur</span>}
    </span>
  );
}
