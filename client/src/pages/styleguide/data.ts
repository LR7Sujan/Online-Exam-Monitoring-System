import React from 'react';
import {
  Layers,
  Activity,
  Grid,
  Zap,
  Shield,
  Database,
  PanelRight,
  PieChart,
  Loader2,
  Sparkles,
  Radio,
} from 'lucide-react';

export interface StyleguideSectionMeta {
  slug: string;
  name: string;
  path: string;
  sectionNumber: string;
  description: string;
  componentCount: number;
  icon: React.ComponentType<{ className?: string }>;
  tags: string[];
}

export const STYLEGUIDE_SECTIONS: StyleguideSectionMeta[] = [
  {
    slug: 'tokens',
    name: 'Design Tokens',
    path: '/styleguide/tokens',
    sectionNumber: '01',
    description: 'Core Aurora Bento color tokens, background variables, and dual-theme palettes.',
    componentCount: 6,
    icon: Layers,
    tags: ['Color', 'Tokens', 'Theme', 'Palette', 'Variables'],
  },
  {
    slug: 'indicators',
    name: 'Live Indicators',
    path: '/styleguide/indicators',
    sectionNumber: '02',
    description: 'Pulsing live beacons, status dots, and websocket connection indicators.',
    componentCount: 6,
    icon: Radio,
    tags: ['LiveDot', 'Telemetry', 'Status', 'Beacons', 'Pulse'],
  },
  {
    slug: 'bento',
    name: 'Bento Grid & Cards',
    path: '/styleguide/bento',
    sectionNumber: '03',
    description: '12-column responsive bento containers, cursor-tracking spotlights, and avatar stacks.',
    componentCount: 5,
    icon: Grid,
    tags: ['BentoGrid', 'BentoCard', 'AvatarStack', 'Layout', 'Grid'],
  },
  {
    slug: 'buttons',
    name: 'Buttons',
    path: '/styleguide/buttons',
    sectionNumber: '04',
    description: 'High-contrast neon interactive buttons with micro-animations and loading spinners.',
    componentCount: 7,
    icon: Zap,
    tags: ['NeonButton', 'Actions', 'Primary', 'Ghost', 'Micro-interactions'],
  },
  {
    slug: 'badges',
    name: 'Badges & Pills',
    path: '/styleguide/badges',
    sectionNumber: '05',
    description: 'Authoritative severity badges, session state pills, and status tags.',
    componentCount: 11,
    icon: Shield,
    tags: ['SeverityBadge', 'StatusPill', 'Violations', 'Tags'],
  },
  {
    slug: 'stat-cards',
    name: 'Stat Cards',
    path: '/styleguide/stat-cards',
    sectionNumber: '06',
    description: 'Metric KPI telemetry cards with sparklines, percent diffs, and count-up animations.',
    componentCount: 4,
    icon: Activity,
    tags: ['StatCard', 'KPI', 'Sparkline', 'Metrics', 'Analytics'],
  },
  {
    slug: 'trust-ring',
    name: 'Trust Ring',
    path: '/styleguide/trust-ring',
    sectionNumber: '07',
    description: 'Dynamic SVG circular risk gauges with smooth transitions across risk thresholds.',
    componentCount: 3,
    icon: Shield,
    tags: ['TrustRing', 'Gauge', 'Integrity', 'SVG', 'Simulator'],
  },
  {
    slug: 'tables',
    name: 'Data Tables',
    path: '/styleguide/tables',
    sectionNumber: '08',
    description: 'Virtual-ready animated data tables with sticky headers, sorting, and dynamic mutations.',
    componentCount: 3,
    icon: Database,
    tags: ['AnimatedTable', 'DataTable', 'Sorting', 'Grid', 'Audit'],
  },
  {
    slug: 'overlays',
    name: 'Drawers & Modals',
    path: '/styleguide/overlays',
    sectionNumber: '09',
    description: 'Centered bento modal dialogs and slide-over side forensics drawers with focus trapping.',
    componentCount: 2,
    icon: PanelRight,
    tags: ['Modal', 'Drawer', 'Dialog', 'Overlay', 'Forensics'],
  },
  {
    slug: 'charts',
    name: 'Charts',
    path: '/styleguide/charts',
    sectionNumber: '10',
    description: 'Recharts donut and pie breakdowns with offset tooltips, center score, and percentage legends.',
    componentCount: 3,
    icon: PieChart,
    tags: ['Donut', 'PieChart', 'Tooltip', 'Legend', 'Recharts'],
  },
  {
    slug: 'loading-empty',
    name: 'Loading & Empty States',
    path: '/styleguide/loading-empty',
    sectionNumber: '11',
    description: 'High-contrast shimmer skeleton loaders and empty state placeholders with actions.',
    componentCount: 3,
    icon: Loader2,
    tags: ['Skeleton', 'Shimmer', 'EmptyState', 'Loaders', 'Placeholder'],
  },
  {
    slug: 'motion',
    name: 'Motion',
    path: '/styleguide/motion',
    sectionNumber: '12',
    description: 'Animated pill and underline tabs, spring accordions, and celebratory particle bursts.',
    componentCount: 3,
    icon: Sparkles,
    tags: ['Tabs', 'ParticleBurst', 'Toast', 'FramerMotion', 'Transitions'],
  },
];

export function getSectionBySlug(slug: string): StyleguideSectionMeta | undefined {
  return STYLEGUIDE_SECTIONS.find((s) => s.slug === slug);
}

export function getPrevNextSections(currentSlug: string): {
  prev?: StyleguideSectionMeta;
  next?: StyleguideSectionMeta;
} {
  const index = STYLEGUIDE_SECTIONS.findIndex((s) => s.slug === currentSlug);
  if (index === -1) return {};
  return {
    prev: index > 0 ? STYLEGUIDE_SECTIONS[index - 1] : undefined,
    next: index < STYLEGUIDE_SECTIONS.length - 1 ? STYLEGUIDE_SECTIONS[index + 1] : undefined,
  };
}
