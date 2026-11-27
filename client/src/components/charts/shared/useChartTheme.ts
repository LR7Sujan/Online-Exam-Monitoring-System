import { useMemo } from 'react';
import { useTheme } from '../../../context/ThemeContext';

export interface ChartSeriesColors {
  indigo: string;
  violet: string;
  fuchsia: string;
  accent: string;
  accentFrom: string;
  accentVia: string;
  accentTo: string;
  emerald: string;
  amber: string;
  rose: string;
  sky: string;
}

export interface ChartTheme {
  isDark: boolean;
  axisText: string;
  gridlines: string;
  axisLines: string;
  axisLine: string; // alias
  cursorColor: string;
  barCursor: {
    fill: string;
    radius?: number;
  };
  lineCursor: {
    stroke: string;
    strokeDasharray: string;
    strokeWidth?: number;
  };
  series: ChartSeriesColors;
  colors: ChartSeriesColors; // alias
  tooltipProps: {
    wrapperStyle: React.CSSProperties;
    offset: number;
    allowEscapeViewBox: { x: boolean; y: boolean };
  };
  barTooltipProps: {
    wrapperStyle: React.CSSProperties;
    offset: number;
    allowEscapeViewBox: { x: boolean; y: boolean };
    cursor: { fill: string; radius?: number };
  };
  lineTooltipProps: {
    wrapperStyle: React.CSSProperties;
    offset: number;
    allowEscapeViewBox: { x: boolean; y: boolean };
    cursor: { stroke: string; strokeDasharray: string };
  };
  axisProps: {
    stroke: string;
    tick: { fill: string; fontSize: number; fontFamily: string };
    tickLine: boolean;
  };
  gridProps: {
    stroke: string;
    strokeDasharray: string;
    opacity: number;
    vertical: boolean;
  };
}

export const SERIES_COLORS: ChartSeriesColors = {
  indigo: 'var(--accent-from)',
  violet: 'var(--accent-via)',
  fuchsia: 'var(--accent-to)',
  accent: 'var(--accent)',
  accentFrom: 'var(--accent-from)',
  accentVia: 'var(--accent-via)',
  accentTo: 'var(--accent-to)',
  emerald: '#10B981',
  amber: '#F59E0B',
  rose: '#F43F5E',
  sky: '#0EA5E9',
};

/**
 * useChartTheme hook returning theme-aware tokens for Recharts charts:
 * - axis text, gridlines, axis lines
 * - brand and semantic series colors (indigo, violet, fuchsia, emerald, amber, rose, sky)
 * - subtle bar chart cursor replacing the default full-height gray box: rgba(99,102,241,0.08) in dark, 0.06 in light
 * - standardized tooltip wrapper settings keeping tooltips above content and inside chart bounds
 */
export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return useMemo<ChartTheme>(() => {
    // Theme-aware tokens: cream palette for light mode (>=4.5:1 contrast)
    const axisText = isDark ? '#A1A1AA' : '#6A6152';
    const gridlines = isDark ? '#27272A' : '#DDD3BE';
    const axisLines = isDark ? '#27272A' : '#DDD3BE';
    const cursorColor = isDark ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'color-mix(in srgb, var(--accent) 8%, transparent)';

    const seriesColors: ChartSeriesColors = {
      indigo: 'var(--accent-from)',
      violet: 'var(--accent-via)',
      fuchsia: 'var(--accent-to)',
      accent: 'var(--accent)',
      accentFrom: 'var(--accent-from)',
      accentVia: 'var(--accent-via)',
      accentTo: 'var(--accent-to)',
      emerald: isDark ? '#10B981' : '#047857',
      amber: isDark ? '#F59E0B' : '#B45309',
      rose: isDark ? '#F43F5E' : '#BE123C',
      sky: isDark ? '#0EA5E9' : '#0369A1',
    };

    const barCursor = {
      fill: cursorColor,
      radius: 4,
    };

    const lineCursor = {
      stroke: isDark ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'color-mix(in srgb, var(--accent) 30%, transparent)',
      strokeDasharray: '3 3',
      strokeWidth: 1,
    };

    const tooltipProps = {
      wrapperStyle: { zIndex: 50, pointerEvents: 'none' as const },
      offset: 14,
      allowEscapeViewBox: { x: false, y: false },
    };

    const barTooltipProps = {
      ...tooltipProps,
      cursor: barCursor,
    };

    const lineTooltipProps = {
      ...tooltipProps,
      cursor: lineCursor,
    };

    const axisProps = {
      stroke: axisLines,
      tick: { fill: axisText, fontSize: 10, fontFamily: 'sans-serif' },
      tickLine: false,
    };

    const gridProps = {
      stroke: gridlines,
      strokeDasharray: '3 3',
      opacity: isDark ? 0.6 : 0.8,
      vertical: false,
    };

    return {
      isDark,
      axisText,
      gridlines,
      axisLines,
      axisLine: axisLines,
      cursorColor,
      barCursor,
      lineCursor,
      series: seriesColors,
      colors: seriesColors,
      tooltipProps,
      barTooltipProps,
      lineTooltipProps,
      axisProps,
      gridProps,
    };
  }, [isDark]);
}

export default useChartTheme;
