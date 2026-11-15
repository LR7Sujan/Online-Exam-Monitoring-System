import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Flame, Activity, Clock, ShieldAlert, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import {
  buildHeatmapMatrix,
  BUCKET_LABELS_6,
  BUCKET_DESCRIPTIONS_6,
  formatHour,
  type RawHeatmapRecord,
} from '../../utils/heatmapMatrix';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState, ErrorState } from '../ui/EmptyState';

export type HeatmapTimeRange = 'all' | '7';

export interface CircadianHeatmapProps {
  className?: string;
  initialRange?: HeatmapTimeRange;
}

export function CircadianHeatmap({
  className = '',
  initialRange = 'all',
}: CircadianHeatmapProps) {
  const [timeRange, setTimeRange] = useState<HeatmapTimeRange>(initialRange);

  const {
    data: rawRecords,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['analytics', 'heatmap', timeRange],
    queryFn: () => {
      const url =
        timeRange === '7' ? '/analytics/heatmap?days=7' : '/analytics/heatmap';
      return api.get<RawHeatmapRecord[]>(url);
    },
    placeholderData: keepPreviousData,
    refetchInterval: 30000,
  });

  const matrix = React.useMemo(() => {
    return buildHeatmapMatrix(rawRecords ?? []);
  }, [rawRecords]);

  const { rows, bucketRows, insights, bucketColTotals } = matrix;
  const hours24 = Array.from({ length: 24 }, (_, i) => i);

  // Helper for cell intensity background
  const getCellClasses = (count: number, max: number) => {
    if (count === 0) {
      return 'bg-muted/15 dark:bg-muted/10 text-muted-foreground/30';
    }
    const intensity = max > 0 ? count / max : 0;
    if (intensity >= 0.65) {
      return 'bg-rose-500/85 text-white font-bold shadow-sm';
    }
    if (intensity >= 0.3) {
      return 'bg-amber-500/35 text-amber-700 dark:text-amber-300 font-semibold';
    }
    return 'bg-brand/25 text-brand font-medium';
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      case 'HIGH':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'MEDIUM':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
      default:
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    }
  };

  return (
    <div
      role="region"
      aria-label="Circadian Incident Heatmap"
      className={`rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4 ${className}`}
    >
      {/* 1. Header & Time Range Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500" />
            <span>Circadian Incident Heatmap (vw_ViolationHeatmap)</span>
          </h3>
          <p className="text-[11px] font-mono text-muted-foreground">
            Aggregated frequency matrix: Hour of Day (0–23) × Infraction Type
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label="Heatmap time range filter"
            className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-medium"
          >
            <button
              type="button"
              data-testid="heatmap-range-all"
              onClick={() => setTimeRange('all')}
              className={`rounded-md px-2.5 py-1 text-xs transition-all ${
                timeRange === 'all'
                  ? 'bg-brand text-white shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All time
            </button>
            <button
              type="button"
              data-testid="heatmap-range-7"
              onClick={() => setTimeRange('7')}
              className={`rounded-md px-2.5 py-1 text-xs transition-all ${
                timeRange === '7'
                  ? 'bg-brand text-white shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Last 7 days
            </button>
          </div>
          <span className="hidden md:inline text-[10px] font-mono text-muted-foreground">
            SQL View Driven
          </span>
        </div>
      </div>

      {/* 2. Insights Summary Bar */}
      {!isLoading && !isError && insights.grandTotal > 0 && (
        <div
          data-testid="heatmap-insights"
          className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1 pb-2 border-b border-border/60"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-elevated border border-border">
            <Activity className="w-3.5 h-3.5 text-brand" />
            <div className="text-[11px] leading-tight">
              <span className="text-muted-foreground block text-[10px]">Grand Total</span>
              <span className="font-bold text-foreground" data-testid="insight-grand-total">
                {insights.grandTotal} incidents
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-elevated border border-border">
            <Flame className="w-3.5 h-3.5 text-rose-500" />
            <div className="text-[11px] leading-tight">
              <span className="text-muted-foreground block text-[10px]">Peak Hour</span>
              <span className="font-bold text-foreground" data-testid="insight-peak-hour">
                {insights.peakHourFormatted} ({insights.peakHourCount})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-elevated border border-border">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <div className="text-[11px] leading-tight">
              <span className="text-muted-foreground block text-[10px]">Quietest Hour</span>
              <span className="font-bold text-foreground" data-testid="insight-quietest-hour">
                {insights.quietestHourFormatted} ({insights.quietestHourCount})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-elevated border border-border">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <div className="text-[11px] leading-tight truncate">
              <span className="text-muted-foreground block text-[10px]">Top Infraction</span>
              <span
                className="font-bold text-foreground truncate block"
                title={`${insights.mostFrequentViolationType} (${insights.mostFrequentViolationCount})`}
                data-testid="insight-top-violation"
              >
                {insights.mostFrequentViolationType} ({insights.mostFrequentViolationCount})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Loading State */}
      {isLoading && !rawRecords && (
        <div className="space-y-3 py-4" data-testid="heatmap-loading">
          <div className="flex justify-between items-center">
            <Skeleton variant="text" className="w-48 h-4" />
            <Skeleton variant="rect" className="w-24 h-6 rounded-md" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <Skeleton variant="rect" className="h-6 w-36 rounded" />
                <div className="flex-1 flex gap-1">
                  {Array.from({ length: 24 }).map((_, j) => (
                    <Skeleton key={j} variant="rect" className="h-6 flex-1 rounded" />
                  ))}
                </div>
                <Skeleton variant="rect" className="h-6 w-12 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Error State */}
      {isError && (
        <ErrorState
          title="Failed to Load Incident Heatmap"
          description={
            (error as Error)?.message ??
            'Could not retrieve circadian violation matrix from the analytics service.'
          }
          onRetry={() => refetch()}
          className="my-2"
        />
      )}

      {/* 5. Empty State */}
      {!isLoading && !isError && insights.grandTotal === 0 && (
        <EmptyState
          icon={<Sparkles className="w-7 h-7 text-emerald-500" />}
          title="Zero Incidents Logged"
          description={
            timeRange === '7'
              ? 'No academic integrity infractions were recorded in the last 7 days.'
              : 'No proctoring violations have been logged in the system.'
          }
          className="my-2"
        />
      )}

      {/* 6. Desktop / Tablet Grid: 24 Hours (>= 640px) */}
      {!isLoading && !isError && insights.grandTotal > 0 && (
        <div className="hidden sm:block overflow-x-auto pb-2" data-testid="heatmap-desktop-grid">
          <div className="min-w-[760px] space-y-1.5 font-mono text-[10px]">
            {/* Header: Label | 24 Hours | Total */}
            <div className="grid grid-cols-[160px_repeat(24,1fr)_54px] gap-1 text-center text-muted-foreground font-semibold">
              <div className="text-left font-bold text-foreground pl-1">VIOLATION TYPE</div>
              {hours24.map((h) => (
                <div key={h} className="truncate" title={formatHour(h)}>
                  {String(h).padStart(2, '0')}h
                </div>
              ))}
              <div className="text-right font-bold text-foreground pr-1">TOTAL</div>
            </div>

            {/* Matrix Rows */}
            {rows.map((row) => (
              <div
                key={row.code}
                data-testid={`heatmap-row-${row.code}`}
                className="grid grid-cols-[160px_repeat(24,1fr)_54px] gap-1 items-center hover:bg-surface-elevated/40 rounded transition-colors"
              >
                {/* Row Label */}
                <div
                  className="truncate text-left text-foreground font-medium pr-1 flex items-center justify-between"
                  title={`${row.label} (${row.code}) — Severity: ${row.severity}`}
                >
                  <span className="truncate">{row.label}</span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded border uppercase font-mono ml-1 shrink-0 ${getSeverityBadgeClass(
                      row.severity
                    )}`}
                  >
                    {row.severity.slice(0, 3)}
                  </span>
                </div>

                {/* 24 Hour Cells */}
                {row.counts.map((cnt, h) => {
                  const bg = getCellClasses(cnt, insights.maxCellCount);
                  return (
                    <div
                      key={h}
                      data-testid={`cell-${row.code}-${h}`}
                      className={`h-7 rounded flex items-center justify-center transition-all select-none ${bg}`}
                      title={`${row.label} at ${formatHour(h)}: ${cnt} incidents`}
                    >
                      {cnt > 0 ? cnt : ''}
                    </div>
                  );
                })}

                {/* Row Total */}
                <div
                  data-testid={`row-total-${row.code}`}
                  className="h-7 rounded bg-surface-elevated border border-border text-foreground font-bold flex items-center justify-end pr-2 text-[11px]"
                  title={`Total ${row.label} incidents: ${row.total}`}
                >
                  {row.total}
                </div>
              </div>
            ))}

            {/* Bottom Summary Row: Hourly Totals & Grand Total */}
            <div
              data-testid="heatmap-bottom-summary"
              className="grid grid-cols-[160px_repeat(24,1fr)_54px] gap-1 items-center pt-1 border-t border-border font-bold"
            >
              <div className="text-left text-muted-foreground text-[10px] pl-1 uppercase">
                HOURLY TOTAL
              </div>
              {insights.colTotals.map((cnt, h) => (
                <div
                  key={h}
                  data-testid={`col-total-${h}`}
                  className="h-7 rounded bg-surface-elevated/60 text-muted-foreground flex items-center justify-center text-[10px]"
                  title={`Total across all violations at ${formatHour(h)}: ${cnt}`}
                >
                  {cnt > 0 ? cnt : '-'}
                </div>
              ))}
              <div
                data-testid="grand-total-cell"
                className="h-7 rounded bg-brand/20 border border-brand/40 text-brand font-extrabold flex items-center justify-end pr-2 text-[11px]"
                title={`Grand Total: ${insights.grandTotal}`}
              >
                {insights.grandTotal}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Mobile View: 6 Four-Hour Buckets (< 640px) */}
      {!isLoading && !isError && insights.grandTotal > 0 && (
        <div className="block sm:hidden space-y-2" data-testid="heatmap-mobile-grid">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-1 border-b border-border">
            <span>6-Bucket Circadian Intervals</span>
            <span className="font-mono">4-Hour Windows</span>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="min-w-[420px] space-y-1.5 font-mono text-[10px]">
              {/* Header: Label | 6 Buckets | Total */}
              <div className="grid grid-cols-[130px_repeat(6,1fr)_50px] gap-1 text-center text-muted-foreground font-semibold">
                <div className="text-left font-bold text-foreground pl-1">TYPE</div>
                {BUCKET_LABELS_6.map((label, b) => (
                  <div key={label} title={BUCKET_DESCRIPTIONS_6[b]}>
                    {label}
                  </div>
                ))}
                <div className="text-right font-bold text-foreground pr-1">TOTAL</div>
              </div>

              {/* Bucket Rows */}
              {bucketRows.map((brow) => (
                <div
                  key={brow.code}
                  className="grid grid-cols-[130px_repeat(6,1fr)_50px] gap-1 items-center"
                >
                  <div className="truncate text-left text-foreground font-medium pr-1" title={brow.label}>
                    {brow.label}
                  </div>
                  {brow.counts.map((cnt, b) => {
                    const bg = getCellClasses(cnt, insights.maxCellCount * 2);
                    return (
                      <div
                        key={b}
                        className={`h-7 rounded flex items-center justify-center transition-all ${bg}`}
                        title={`${brow.label} [${BUCKET_DESCRIPTIONS_6[b]}]: ${cnt} incidents`}
                      >
                        {cnt > 0 ? cnt : ''}
                      </div>
                    );
                  })}
                  <div className="h-7 rounded bg-surface-elevated border border-border text-foreground font-bold flex items-center justify-end pr-2 text-[10px]">
                    {brow.total}
                  </div>
                </div>
              ))}

              {/* Bucket Bottom Summary Row */}
              <div className="grid grid-cols-[130px_repeat(6,1fr)_50px] gap-1 items-center pt-1 border-t border-border font-bold">
                <div className="text-left text-muted-foreground text-[10px] pl-1">TOTAL</div>
                {bucketColTotals.map((cnt, b) => (
                  <div
                    key={b}
                    className="h-7 rounded bg-surface-elevated/60 text-muted-foreground flex items-center justify-center text-[10px]"
                    title={`Bucket [${BUCKET_DESCRIPTIONS_6[b]}] Total: ${cnt}`}
                  >
                    {cnt > 0 ? cnt : '-'}
                  </div>
                ))}
                <div className="h-7 rounded bg-brand/20 border border-brand/40 text-brand font-extrabold flex items-center justify-end pr-2 text-[10px]">
                  {insights.grandTotal}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
