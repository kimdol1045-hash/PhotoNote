import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function svg(size: number, props: SVGProps<SVGSVGElement>) {
  return {
    ...props,
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

export const IconCamera = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2l1.2-1.6a1 1 0 0 1 .8-.4h5a1 1 0 0 1 .8.4L16.5 6h2A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

export const IconPlus = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconChevronDown = ({ size = 20, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const IconChevronLeft = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export const IconClose = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="M6 6 18 18M18 6 6 18" />
  </svg>
);

export const IconCheck = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="m5 12 5 5L20 7" />
  </svg>
);

export const IconImage = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4 18 5-5 4 4 3-3 4 4" />
  </svg>
);

export const IconFolder = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

export const IconRotate = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v5h-5" />
  </svg>
);

export const IconMore = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <circle cx="6" cy="12" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="18" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

export const IconPen = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

export const IconText = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="M5 6V4h14v2" />
    <path d="M12 4v16" />
    <path d="M9 20h6" />
  </svg>
);

export const IconEraser = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="m3 17 6 6h12v-2h-7l8.5-8.5a2 2 0 0 0 0-2.83l-6.17-6.17a2 2 0 0 0-2.83 0L3 13z" />
    <path d="M9 7l8 8" />
  </svg>
);

export const IconUndo = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
  </svg>
);

export const IconRedo = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9a5 5 0 0 0 0 10h3" />
  </svg>
);

export const IconDownload = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="M12 4v12m0 0-4-4m4 4 4-4" />
    <path d="M4 19h16" />
  </svg>
);

export const IconTrash = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="M4 7h16" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const IconMove = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="M5 9V5h4M19 9V5h-4M5 15v4h4M19 15v4h-4" />
  </svg>
);

export const IconEdit = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="M4 20h4l10-10-4-4L4 16z" />
    <path d="M14 6l4 4" />
  </svg>
);

export const IconSave = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <path d="M5 5a2 2 0 0 1 2-2h10l4 4v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
    <path d="M7 3v6h8V3M7 21v-7h10v7" />
  </svg>
);

export const IconSettings = ({ size = 24, ...rest }: IconProps) => (
  <svg {...svg(size, rest)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 0 1 7.04 4.29l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09c0 .66.39 1.26 1 1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9c.25.61.85 1 1.51 1H21a2 2 0 0 1 0 4h-.09c-.66 0-1.26.39-1.51 1z" />
  </svg>
);
