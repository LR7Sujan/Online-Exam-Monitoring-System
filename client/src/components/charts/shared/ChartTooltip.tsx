import React from 'react';

export interface ChartTooltipItem {
  name?: React.ReactNode;
  value?: React.ReactNode;
  color?: string;
  fill?: string;
  dataKey?: string | number;
  unit?: string;
  payload?: Record<string, unknown>;
}

export type ChartTooltipFormatter = (
  value: unknown,
  name: unknown,
  item: ChartTooltipItem,
  index: number,
  payload: ChartTooltipItem[]
) =>
  | React.ReactNode
  | [React.ReactNode, React.ReactNode]
  | {
      value?: React.ReactNode;
      label?: React.ReactNode;
      percent?: string | number;
      color?: string;
    };

export interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipItem[];
  label?: string | number;
  title?: React.ReactNode | ((label: unknown, payload: ChartTooltipItem[]) => React.ReactNode);
  labelFormatter?: (label: unknown, payload: ChartTooltipItem[]) => React.ReactNode;
  formatter?: ChartTooltipFormatter;
  showPercent?: boolean;
  hideLabel?: boolean;
  hideSwatch?: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Authoritative Recharts custom tooltip component.
 * Features:
 * - 100% SOLID var(--surface) background (never translucent or blurry)
 * - 1px border with var(--border)
 * - Layered shadow
 * - 12px radius (rounded-[12px])
 * - 13px sans-serif typography (not mono)
 * - Structured rows with color swatch + label + value (+ percent when provided)
 * - Extensible formatter callback
 */
export function ChartTooltip({
  active,
  payload,
  label,
  title,
  labelFormatter,
  formatter,
  showPercent = false,
  hideLabel = false,
  hideSwatch = false,
  valuePrefix = '',
  valueSuffix = '',
  className = '',
  style,
  children,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  // Filter out invalid items or zero-placeholder items if any
  const visiblePayload = payload.filter((item) => !item.payload?.isPlaceholder);
  if (visiblePayload.length === 0) {
    return null;
  }

  // Resolve Header Title
  let resolvedTitle: React.ReactNode = null;
  if (typeof title === 'function') {
    resolvedTitle = title(label, visiblePayload);
  } else if (title !== undefined && title !== null) {
    resolvedTitle = title;
  } else if (labelFormatter) {
    resolvedTitle = labelFormatter(label, visiblePayload);
  } else if (!hideLabel && label !== undefined && label !== null && String(label).trim() !== '') {
    resolvedTitle = String(label);
  }

  return (
    <div
      role="tooltip"
      className={`rounded-[12px] border border-border bg-surface dark:bg-[#111114] p-3 text-[13px] font-sans antialiased text-foreground shadow-layered-md select-none transition-shadow ${className}`}
      style={{
        backgroundColor: 'var(--surface)',
        minWidth: '148px',
        maxWidth: '280px',
        ...style,
      }}
    >
      {/* Tooltip Header / Title */}
      {resolvedTitle && (
        <div className="font-semibold text-foreground text-[13px] font-sans pb-1.5 mb-1.5 border-b border-border/60 leading-snug break-words max-w-full">
          {resolvedTitle}
        </div>
      )}

      {/* Custom Children Override */}
      {children}

      {/* Payload Rows */}
      {!children && (
        <div className="space-y-1.5">
          {visiblePayload.map((item, index) => {
            // Determine Swatch Color
            const swatchColor =
              item.color ||
              item.fill ||
              (typeof item.payload?.fill === 'string' ? item.payload.fill : undefined) ||
              (typeof item.payload?.color === 'string' ? item.payload.color : undefined) ||
              '#6366F1';

            // Raw Name & Value
            const rawName = item.name ?? String(item.dataKey ?? `Series ${index + 1}`);
            const rawVal = item.value;

            // Formatter evaluation
            let displayVal: React.ReactNode =
              rawVal !== undefined && rawVal !== null
                ? `${valuePrefix}${String(rawVal)}${valueSuffix}`
                : '';
            let displayLabel: React.ReactNode = rawName;
            let percentVal: string | number | undefined = undefined;
            let customSwatchColor = swatchColor;

            if (formatter) {
              const res = formatter(rawVal, rawName, item, index, visiblePayload);
              if (Array.isArray(res)) {
                displayVal = res[0];
                displayLabel = res[1] ?? displayLabel;
              } else if (res && typeof res === 'object' && !React.isValidElement(res)) {
                const obj = res as {
                  value?: React.ReactNode;
                  label?: React.ReactNode;
                  percent?: string | number;
                  color?: string;
                };
                if (obj.value !== undefined) displayVal = obj.value;
                if (obj.label !== undefined) displayLabel = obj.label;
                if (obj.percent !== undefined) percentVal = obj.percent;
                if (obj.color) customSwatchColor = obj.color;
              } else if (res !== undefined) {
                displayVal = res;
              }
            }

            // Automatic percent calculation or extraction if requested
            if (percentVal === undefined && (showPercent || item.payload?.percent !== undefined || item.payload?.percentage !== undefined)) {
              if (typeof item.payload?.percent === 'string' || typeof item.payload?.percent === 'number') {
                percentVal = item.payload.percent;
              } else if (typeof item.payload?.percentage === 'string' || typeof item.payload?.percentage === 'number') {
                percentVal = item.payload.percentage;
              } else if (typeof item.payload?.total === 'number' && item.payload.total > 0 && typeof rawVal === 'number') {
                percentVal = Math.round((rawVal / item.payload.total) * 100);
              }
            }

            const formattedPercent =
              percentVal !== undefined && percentVal !== null
                ? typeof percentVal === 'number'
                  ? `${percentVal}%`
                  : String(percentVal).endsWith('%')
                  ? percentVal
                  : `${percentVal}%`
                : null;

            return (
              <div
                key={`item-${item.dataKey ?? index}-${rawName}`}
                className="flex items-center justify-between gap-3 text-[13px] font-sans leading-tight"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {!hideSwatch && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: customSwatchColor }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-muted-foreground truncate">{displayLabel}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 font-medium">
                  <span className="text-foreground tabular-nums font-sans">{displayVal}</span>
                  {formattedPercent && (
                    <span className="text-muted-foreground text-[11px] tabular-nums font-sans">
                      ({formattedPercent})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ChartTooltip;
