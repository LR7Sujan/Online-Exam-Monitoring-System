import { useMemo } from 'react';
import { useTheme } from '../../../context/ThemeContext';

export interface ChartSeriesColors {
  indigo: string;
  violet: string;
  fuchsia: string;
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

const SERIES_COLORS: ChartSeriesColors = {
  indigo: '#6366F1',
  violet: '#8B5CF6',
  fuchsia: '#D946EF',
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
    // Theme-aware tokens
    const axisText = isDark ? '#A1A1AA' : '#71717A'; // zinc-400 vs zinc-500
    const gridlines = isDark ? '#27272A' : '#E4E4E7'; // zinc-800 vs zinc-200
    const axisLines = isDark ? '#27272A' : '#E4E4E7';
    const cursorColor = isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.06)';

    const barCursor = {
      fill: cursorColor,
      radius: 4,
    };

    const lineCursor = {
      stroke: isDark ? 'rgba(99, 102, 241, 0.35)' : 'rgba(99, 102, 241, 0.25)',
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
      series: SERIES_COLORS,
      colors: SERIES_COLORS,
      tooltipProps,
      barTooltipProps,
      lineTooltipProps,
      axisProps,
      gridProps,
    };
  }, [isDark]);
}

export default useChartTheme;
