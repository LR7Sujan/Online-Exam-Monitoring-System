import React, { useState, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Flame,
  Shield,
  AlertTriangle,
  AlertOctagon,
  Info,
  Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api';
import {
  buildHeatmapMatrix,
  BUCKET_LABELS_6,
  BUCKET_DESCRIPTIONS_6,
  formatHour,
  formatHourSimple,
  formatHourCompact3h,
  formatHourRange,
  type RawHeatmapRecord,
} from '../../utils/heatmapMatrix';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState, ErrorState } from '../ui/EmptyState';

export type HeatmapTimeRange = 'all' | '7';

export interface CircadianHeatmapProps {
  className?: string;
  initialRange?: HeatmapTimeRange;
}

interface ActiveCellState {
  rowIdx: number;
  rowCode: string;
  hour: number;
  isBucket?: boolean;
  x: number;
  y: number;
}

/**
 * Single-hue indigo scale with 5 steps:
 * Step 0: Zero count (faint empty cell)
 * Step 1: 1 - 25% of max
 * Step 2: 26% - 50% of max
 * Step 3: 51% - 75% of max
 * Step 4: 76% - 100% of max
 */
function getIndigoCellClasses(count: number, max: number): {
  step: number;
  bg: string;
} {
  if (count === 0) {
    return {
      step: 0,
      bg: 'bg-surface-elevated/70 border-border text-transparent hover:border-border-strong dark:bg-zinc-900/40 dark:border-border',
    };
  }
  const ratio = max > 0 ? count / max : 0;
  if (ratio <= 0.25) {
    return {
      step: 1,
      bg: 'bg-accent/15 text-accent border-accent/25 dark:bg-accent/20 dark:text-accent dark:border-accent/30',
    };
  }
  if (ratio <= 0.5) {
    return {
      step: 2,
      bg: 'bg-accent/35 text-foreground border-accent/40 dark:bg-accent/40 dark:text-foreground dark:border-accent/50',
    };
  }
  if (ratio <= 0.75) {
    return {
      step: 3,
      bg: 'bg-accent/70 text-accent-foreground border-accent/80 dark:bg-accent/70 dark:text-accent-foreground dark:border-accent/80 shadow-sm',
    };
  }
  return {
    step: 4,
    bg: 'bg-accent text-accent-foreground border-accent dark:bg-accent dark:text-accent-foreground dark:border-accent shadow-[0_0_8px_var(--accent-glow)]',
  };
}

const LEGEND_STEPS = [
  { label: '0', title: 'Zero incidents (empty cell)', bg: 'bg-surface-elevated border-border dark:bg-zinc-900/40 dark:border-border' },
  { label: 'Low', title: 'Low incidents (1 - 25%)', bg: 'bg-accent/15 border-accent/25' },
  { label: 'Med', title: 'Medium incidents (26 - 50%)', bg: 'bg-accent/35 border-accent/40' },
  { label: 'High', title: 'High incidents (51 - 75%)', bg: 'bg-accent/70 border-accent/80' },
  { label: 'Peak', title: 'Peak incidents (76 - 100%)', bg: 'bg-accent border-accent' },
];

function SeverityIcon({ severity, className = 'w-3.5 h-3.5' }: { severity: string; className?: string }) {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL':
      return <AlertOctagon className={`${className} text-rose-500`} />;
    case 'HIGH':
      return <AlertTriangle className={`${className} text-amber-500`} />;
    case 'MEDIUM':
      return <Shield className={`${className} text-accent`} />;
    default:
      return <Info className={`${className} text-emerald-500`} />;
  }
}

export function CircadianHeatmap({
  className = '',
  initialRange = 'all',
}: CircadianHeatmapProps) {
  const [timeRange, setTimeRange] = useState<HeatmapTimeRange>(initialRange);
  const [activeCell, setActiveCell] = useState<ActiveCellState | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ rowIdx: number; hour: number }>({ rowIdx: 0, hour: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Arrow key navigation for 24-hour grid
  const handleCellKeyDown = (
    e: React.KeyboardEvent,
    rowIdx: number,
    hour: number
  ) => {
    let nextRow = rowIdx;
    let nextHour = hour;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextHour = (hour + 1) % 24;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextHour = (hour - 1 + 24) % 24;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      nextRow = (rowIdx + 1) % rows.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nextRow = (rowIdx - 1 + rows.length) % rows.length;
    } else if (e.key === 'Escape') {
      setActiveCell(null);
      return;
    } else {
      return;
    }

    setFocusedCell({ rowIdx: nextRow, hour: nextHour });

    const targetRow = rows[nextRow];
    if (targetRow) {
      const cellElem = containerRef.current?.querySelector(
        `[data-testid="cell-${targetRow.code}-${nextHour}"]`
      ) as HTMLElement | null;

      if (cellElem) {
        cellElem.focus();
        const rect = cellElem.getBoundingClientRect();
        setActiveCell({
          rowIdx: nextRow,
          rowCode: targetRow.code,
          hour: nextHour,
          isBucket: false,
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      }
    }
  };

  // Helper for tooltip data
  const activeRow = activeCell ? rows[activeCell.rowIdx] : null;
  const activeBucketRow = activeCell && activeCell.isBucket ? bucketRows[activeCell.rowIdx] : null;
  const activeCount = !activeCell
    ? 0
    : activeCell.isBucket
    ? activeBucketRow?.counts[activeCell.hour] ?? 0
    : activeRow?.counts[activeCell.hour] ?? 0;

  const pctGrand =
    insights.grandTotal > 0
      ? ((activeCount / insights.grandTotal) * 100).toFixed(1)
      : '0';

  const hourTotal = !activeCell
    ? 0
    : activeCell.isBucket
    ? bucketColTotals[activeCell.hour] ?? 0
    : insights.colTotals[activeCell.hour] ?? 0;

  const pctHour =
    hourTotal > 0 ? ((activeCount / hourTotal) * 100).toFixed(1) : '0';

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Circadian Incident Heatmap"
      className={`rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4 relative ${className}`}
    >
      {/* 1. Header & Time Range Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Circadian Incident Heatmap (vw_ViolationHeatmap)</span>
          </h3>
          {!isLoading && !isError && insights.grandTotal > 0 && (
            <p className="text-xs text-muted-foreground font-sans mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>
                <strong className="text-foreground font-medium">Peak hour:</strong>{' '}
                {insights.peakHourSimple}
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span>
                <strong className="text-foreground font-medium">Most frequent:</strong>{' '}
                {insights.mostFrequentViolationType}
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span>
                <strong className="text-foreground font-medium">Quietest:</strong>{' '}
                {insights.quietestHourSimple}
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div
            role="group"
            aria-label="Heatmap time range filter"
            className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-medium"
          >
            <button
              type="button"
              data-testid="heatmap-range-all"
              onClick={() => {
                setTimeRange('all');
                setActiveCell(null);
              }}
              className={`rounded-md px-2.5 py-1 text-xs transition-all cursor-pointer ${
                timeRange === 'all'
                  ? 'bg-brand text-accent-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All time
            </button>
            <button
              type="button"
              data-testid="heatmap-range-7"
              onClick={() => {
                setTimeRange('7');
                setActiveCell(null);
              }}
              className={`rounded-md px-2.5 py-1 text-xs transition-all cursor-pointer ${
                timeRange === '7'
                  ? 'bg-brand text-accent-foreground shadow-sm font-semibold'
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

      {/* Accessible Insights Summary for E2E Automation / Screen Readers */}
      {!isLoading && !isError && insights.grandTotal > 0 && (
        <div data-testid="heatmap-insights" className="sr-only">
          <span data-testid="insight-grand-total">{insights.grandTotal} incidents</span>
          <span data-testid="insight-peak-hour">{insights.peakHourFormatted}</span>
          <span data-testid="insight-quietest-hour">{insights.quietestHourFormatted}</span>
          <span data-testid="insight-top-violation">{insights.mostFrequentViolationType}</span>
        </div>
      )}

      {/* 2. Loading State */}
      {isLoading && !rawRecords && (
        <div className="space-y-3 py-4" data-testid="heatmap-loading">
          <div className="flex justify-between items-center">
            <Skeleton variant="text" className="w-56 h-4" />
            <Skeleton variant="rect" className="w-24 h-6 rounded-md" />
          </div>
          <div className="space-y-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-[2px] items-center">
                <Skeleton variant="rect" className="h-7 w-44 rounded-[6px]" />
                <div className="flex-1 flex gap-[2px]">
                  {Array.from({ length: 24 }).map((_, j) => (
                    <Skeleton key={j} variant="rect" className="h-7 flex-1 rounded-[6px]" />
                  ))}
                </div>
                <Skeleton variant="rect" className="h-7 w-14 rounded-[6px]" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Error State */}
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

      {/* 4. Empty State */}
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

      {/* 5. Desktop Grid: 24 Hours (>= 640px) */}
      {!isLoading && !isError && insights.grandTotal > 0 && (
        <div className="hidden sm:block overflow-x-auto pb-2" data-testid="heatmap-desktop-grid">
          <div
            role="grid"
            aria-label="Hourly Circadian Infraction Frequency Matrix"
            className="min-w-[800px] space-y-[2px]"
          >
            {/* Top Bar Strip: Hourly Totals */}
            <div className="grid grid-cols-[180px_repeat(24,1fr)_54px] gap-[2px] items-end h-7 pb-1">
              <div className="text-[10px] font-mono text-muted-foreground/60 text-right pr-2 select-none">
                HOURLY
              </div>
              {hours24.map((h) => {
                const colCnt = insights.colTotals[h] ?? 0;
                const maxHour = insights.peakHourCount > 0 ? insights.peakHourCount : 1;
                const barHeightPercent = Math.max(12, Math.round((colCnt / maxHour) * 100));
                const isColActive = activeCell?.hour === h;
                return (
                  <div
                    key={h}
                    className="h-full flex items-end justify-center"
                    title={`Hour ${formatHourSimple(h)} total: ${colCnt} incidents`}
                  >
                    <div
                      style={{ height: `${barHeightPercent}%` }}
                      className={`w-full max-w-[14px] rounded-t-[2px] transition-all duration-150 ${
                        isColActive
                          ? 'bg-accent'
                          : 'bg-accent/25 hover:bg-accent/50'
                      }`}
                    />
                  </div>
                );
              })}
              <div />
            </div>

            {/* Hour Labels Row: Every 3 hours (12a, 3a, 6a, ...) */}
            <div className="grid grid-cols-[180px_repeat(24,1fr)_54px] gap-[2px] text-center text-muted-foreground font-mono text-[10px] pb-1 select-none">
              <div className="text-left font-semibold text-foreground pl-1">VIOLATION TYPE</div>
              {hours24.map((h) => {
                const compactLabel = formatHourCompact3h(h);
                const isColActive = activeCell?.hour === h;
                return (
                  <div
                    key={h}
                    className={`truncate font-medium transition-colors ${
                      isColActive ? 'text-brand font-bold' : ''
                    }`}
                    title={formatHour(h)}
                  >
                    {compactLabel}
                  </div>
                );
              })}
              <div className="text-right font-semibold text-foreground pr-1">TOTAL</div>
            </div>

            {/* Matrix Rows */}
            {rows.map((row, rowIdx) => {
              const isRowActive = activeCell?.rowCode === row.code;
              return (
                <div
                  key={row.code}
                  role="row"
                  data-testid={`heatmap-row-${row.code}`}
                  className="grid grid-cols-[180px_repeat(24,1fr)_54px] gap-[2px] items-center"
                >
                  {/* Row Label with Severity Icon */}
                  <div
                    className={`truncate text-left text-xs font-medium pr-1 flex items-center gap-1.5 transition-colors select-none ${
                      isRowActive ? 'text-brand font-semibold' : 'text-foreground'
                    }`}
                    title={`${row.label} (${row.code}) — Severity: ${row.severity}`}
                  >
                    <SeverityIcon severity={row.severity} className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{row.label}</span>
                  </div>

                  {/* 24 Hour Cells */}
                  {row.counts.map((cnt, h) => {
                    const { bg } = getIndigoCellClasses(cnt, insights.maxCellCount);
                    const isCurrent = activeCell?.rowCode === row.code && activeCell?.hour === h;
                    const isCrosshair = activeCell && (activeCell.rowCode === row.code || activeCell.hour === h);
                    const isDimmed = activeCell && !isCrosshair;
                    const isFocused = focusedCell.rowIdx === rowIdx && focusedCell.hour === h;

                    return (
                      <button
                        key={h}
                        type="button"
                        role="gridcell"
                        tabIndex={isFocused ? 0 : -1}
                        data-testid={`cell-${row.code}-${h}`}
                        aria-label={`${row.label}, ${formatHourRange(h)}, ${cnt} ${cnt === 1 ? 'incident' : 'incidents'}`}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setActiveCell({
                            rowIdx,
                            rowCode: row.code,
                            hour: h,
                            isBucket: false,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }}
                        onMouseLeave={() => {
                          setActiveCell(null);
                        }}
                        onFocus={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setFocusedCell({ rowIdx, hour: h });
                          setActiveCell({
                            rowIdx,
                            rowCode: row.code,
                            hour: h,
                            isBucket: false,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }}
                        onBlur={() => {
                          setActiveCell(null);
                        }}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIdx, h)}
                        className={`h-7 w-full rounded-[6px] border flex items-center justify-center transition-all duration-150 outline-none select-none cursor-pointer ${bg} ${
                          isCurrent
                            ? 'ring-2 ring-brand z-20 scale-[1.08] shadow-md'
                            : isCrosshair
                            ? 'opacity-100 ring-1 ring-brand/40 z-10'
                            : isDimmed
                            ? 'opacity-35'
                            : 'opacity-100 hover:scale-[1.04]'
                        }`}
                      >
                        {/* Show number inside cell on large cards when count > 0 */}
                        {cnt > 0 && (
                          <span className="hidden xl:inline text-[9px] font-mono font-semibold leading-none pointer-events-none">
                            {cnt}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* Row Total */}
                  <div
                    data-testid={`row-total-${row.code}`}
                    className="h-7 rounded-[6px] bg-surface-elevated border border-border text-foreground font-mono font-bold flex items-center justify-end pr-2 text-[11px]"
                    title={`Total ${row.label} incidents: ${row.total}`}
                  >
                    {row.total}
                  </div>
                </div>
              );
            })}

            {/* Bottom Summary Row: Hourly Totals & Grand Total */}
            <div
              data-testid="heatmap-bottom-summary"
              className="grid grid-cols-[180px_repeat(24,1fr)_54px] gap-[2px] items-center pt-2 border-t border-border font-mono text-[10px]"
            >
              <div className="text-left text-muted-foreground font-semibold pl-1 uppercase select-none">
                HOURLY TOTAL
              </div>
              {insights.colTotals.map((cnt, h) => {
                const isColActive = activeCell?.hour === h;
                return (
                  <div
                    key={h}
                    data-testid={`col-total-${h}`}
                    className={`h-6 rounded-[6px] text-center flex items-center justify-center font-semibold transition-colors ${
                      isColActive
                        ? 'bg-brand/20 text-brand font-bold'
                        : 'text-muted-foreground/80'
                    }`}
                    title={`Hour ${formatHourSimple(h)} total across all violations: ${cnt}`}
                  >
                    {cnt > 0 ? cnt : '-'}
                  </div>
                );
              })}
              <div
                data-testid="grand-total-cell"
                className="h-7 rounded-[6px] bg-brand/15 border border-brand/40 text-brand font-mono font-extrabold flex items-center justify-end pr-2 text-[11px]"
                title={`Grand Total: ${insights.grandTotal}`}
              >
                {insights.grandTotal}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Mobile View: 6 Four-Hour Buckets (< 640px) */}
      {!isLoading && !isError && insights.grandTotal > 0 && (
        <div className="block sm:hidden space-y-2" data-testid="heatmap-mobile-grid">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-1 border-b border-border select-none">
            <span>6-Bucket Circadian Intervals</span>
            <span className="font-mono text-[10px]">4-Hour Windows</span>
          </div>

          <div className="overflow-x-auto pb-1">
            <div
              role="grid"
              aria-label="Circadian Infraction Matrix 4-Hour Buckets"
              className="min-w-[420px] space-y-[2px]"
            >
              {/* Header: Label | 6 Buckets | Total */}
              <div className="grid grid-cols-[130px_repeat(6,1fr)_50px] gap-[2px] text-center text-muted-foreground font-mono text-[10px] pb-1 font-semibold select-none">
                <div className="text-left font-bold text-foreground pl-1">TYPE</div>
                {BUCKET_LABELS_6.map((label, b) => (
                  <div key={label} title={BUCKET_DESCRIPTIONS_6[b]}>
                    {label}
                  </div>
                ))}
                <div className="text-right font-bold text-foreground pr-1">TOTAL</div>
              </div>

              {/* Bucket Rows */}
              {bucketRows.map((brow, rowIdx) => {
                const isRowActive = activeCell?.isBucket && activeCell?.rowCode === brow.code;
                return (
                  <div
                    key={brow.code}
                    role="row"
                    className="grid grid-cols-[130px_repeat(6,1fr)_50px] gap-[2px] items-center"
                  >
                    <div
                      className={`truncate text-left text-xs font-medium pr-1 flex items-center gap-1.5 transition-colors select-none ${
                        isRowActive ? 'text-brand font-semibold' : 'text-foreground'
                      }`}
                      title={`${brow.label} (${brow.code})`}
                    >
                      <SeverityIcon severity={brow.severity} className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{brow.label}</span>
                    </div>

                    {brow.counts.map((cnt, b) => {
                      const { bg } = getIndigoCellClasses(cnt, insights.maxCellCount * 2);
                      const isCurrent =
                        activeCell?.isBucket &&
                        activeCell?.rowCode === brow.code &&
                        activeCell?.hour === b;
                      const isCrosshair =
                        activeCell?.isBucket &&
                        (activeCell.rowCode === brow.code || activeCell.hour === b);
                      const isDimmed = activeCell?.isBucket && !isCrosshair;

                      return (
                        <button
                          key={b}
                          type="button"
                          role="gridcell"
                          tabIndex={0}
                          aria-label={`${brow.label}, ${BUCKET_DESCRIPTIONS_6[b]}, ${cnt} incidents`}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setActiveCell({
                              rowIdx,
                              rowCode: brow.code,
                              hour: b,
                              isBucket: true,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }}
                          onMouseLeave={() => setActiveCell(null)}
                          onFocus={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setActiveCell({
                              rowIdx,
                              rowCode: brow.code,
                              hour: b,
                              isBucket: true,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }}
                          onBlur={() => setActiveCell(null)}
                          className={`h-7 w-full rounded-[6px] border flex items-center justify-center transition-all duration-150 outline-none select-none cursor-pointer ${bg} ${
                            isCurrent
                              ? 'ring-2 ring-brand z-20 scale-[1.08] shadow-md'
                              : isCrosshair
                              ? 'opacity-100 ring-1 ring-brand/40 z-10'
                              : isDimmed
                              ? 'opacity-35'
                              : 'opacity-100'
                          }`}
                        >
                          {cnt > 0 && (
                            <span className="text-[10px] font-mono font-semibold pointer-events-none">
                              {cnt}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    <div className="h-7 rounded-[6px] bg-surface-elevated border border-border text-foreground font-mono font-bold flex items-center justify-end pr-2 text-[10px]">
                      {brow.total}
                    </div>
                  </div>
                );
              })}

              {/* Bucket Bottom Summary Row */}
              <div className="grid grid-cols-[130px_repeat(6,1fr)_50px] gap-[2px] items-center pt-2 border-t border-border font-mono text-[10px] font-bold">
                <div className="text-left text-muted-foreground pl-1 select-none">TOTAL</div>
                {bucketColTotals.map((cnt, b) => {
                  const isColActive = activeCell?.isBucket && activeCell?.hour === b;
                  return (
                    <div
                      key={b}
                      className={`h-6 rounded-[6px] flex items-center justify-center transition-colors ${
                        isColActive ? 'bg-brand/20 text-brand font-bold' : 'text-muted-foreground/80'
                      }`}
                      title={`Bucket [${BUCKET_DESCRIPTIONS_6[b]}] Total: ${cnt}`}
                    >
                      {cnt > 0 ? cnt : '-'}
                    </div>
                  );
                })}
                <div className="h-7 rounded-[6px] bg-brand/15 border border-brand/40 text-brand font-extrabold flex items-center justify-end pr-2 text-[10px]">
                  {insights.grandTotal}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Legend: "Less" to "More" with 5 Swatches */}
      {!isLoading && !isError && insights.grandTotal > 0 && (
        <div className="flex items-center justify-end gap-2 pt-1 text-[11px] font-sans text-muted-foreground select-none">
          <span className="font-medium">Less</span>
          <div className="flex items-center gap-[3px]" role="group" aria-label="Infraction intensity legend">
            {LEGEND_STEPS.map((step, idx) => (
              <div
                key={idx}
                title={step.title}
                className={`w-3.5 h-3.5 rounded-[4px] border ${step.bg}`}
              />
            ))}
          </div>
          <span className="font-medium">More</span>
        </div>
      )}

      {/* 8. Shared Solid Tooltip (z-50, opaque var(--surface) background) */}
      {activeCell && (
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            left: Math.max(130, Math.min(window.innerWidth - 130, activeCell.x)),
            top: Math.max(10, activeCell.y - 12),
            transform: 'translate(-50%, -100%)',
          }}
          className="pointer-events-none z-50 min-w-[220px] rounded-xl border border-border bg-surface p-3.5 shadow-2xl text-foreground font-sans animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border pb-2 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <SeverityIcon
                severity={
                  activeCell.isBucket
                    ? activeBucketRow?.severity ?? 'LOW'
                    : activeRow?.severity ?? 'LOW'
                }
                className="w-3.5 h-3.5 shrink-0"
              />
              <span className="font-semibold text-xs text-foreground truncate">
                {activeCell.isBucket ? activeBucketRow?.label : activeRow?.label}
              </span>
            </div>
            <span className="font-mono text-[9px] uppercase px-1 py-0.5 rounded bg-muted/40 font-semibold shrink-0">
              {activeCell.isBucket ? activeBucketRow?.severity : activeRow?.severity}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Time Window</span>
              <span className="font-medium text-foreground">
                {activeCell.isBucket
                  ? BUCKET_DESCRIPTIONS_6[activeCell.hour]
                  : formatHourRange(activeCell.hour)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Incidents</span>
              <span className="font-bold font-mono text-brand text-sm">
                {activeCount} {activeCount === 1 ? 'incident' : 'incidents'}
              </span>
            </div>

            <div className="pt-1.5 border-t border-border space-y-1 text-[11px] text-muted-foreground">
              <div className="flex justify-between items-center">
                <span>Share of Grand Total:</span>
                <span className="font-mono font-medium text-foreground">
                  {pctGrand}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>
                  Share of{' '}
                  {activeCell.isBucket
                    ? BUCKET_LABELS_6[activeCell.hour]
                    : formatHourSimple(activeCell.hour)}{' '}
                  Total:
                </span>
                <span className="font-mono font-medium text-foreground">
                  {pctHour}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
