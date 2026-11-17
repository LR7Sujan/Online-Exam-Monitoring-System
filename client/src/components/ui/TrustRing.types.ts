export type TrustRingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

export interface TrustRingProps {
  score: number;
  minThreshold?: number;
  size?: TrustRingSize;
  showLabel?: boolean;
  showThresholdMarker?: boolean;
  sublabel?: string;
  className?: string;
  'data-testid'?: string;
}

export const TRUST_RING_SIZES: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
  xs: 40,
  sm: 56,
  md: 80,
  lg: 160,
  xl: 220,
};
