/**
 * Inline SVG icons. The Next.js app uses lucide-react via `@/modules/ui/icons`;
 * to keep the Fresh app dependency-free we hand-roll the small subset we need.
 * All icons are 24x24 with `currentColor` strokes — size them with CSS.
 */

interface IconProps {
  class?: string;
  "aria-hidden"?: boolean;
}

function svgProps(extra: IconProps) {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linecap": "round" as const,
    "stroke-linejoin": "round" as const,
    "aria-hidden": true,
    ...extra,
  };
}

export function LayoutIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function PlayCircleIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function UserCog2Icon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21v-2a4 4 0 0 1 4-4h6" />
      <circle cx="18" cy="15" r="3" />
      <path d="M18 10v2" />
      <path d="M18 18v2" />
      <path d="M22 15h-2" />
      <path d="M16 15h-2" />
      <path d="m21 12-1.5 1.5" />
      <path d="M16.5 16.5 15 18" />
      <path d="m21 18-1.5-1.5" />
      <path d="M16.5 13.5 15 12" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
