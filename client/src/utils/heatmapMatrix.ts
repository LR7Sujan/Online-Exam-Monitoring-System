export interface RawHeatmapRecord {
  hour_of_day: number | string;
  violation_code: string;
  violation_label?: string;
  severity?: string;
  violation_count: number | string;
  total_penalty_points?: number | string;
}

export interface ViolationTypeMeta {
  code: string;
  label: string;
  severity: string;
}

export const KNOWN_VIOLATION_TYPES: ViolationTypeMeta[] = [
  { code: 'TAB_SWITCH', label: 'Tab / Window Switch', severity: 'MEDIUM' },
  { code: 'FULLSCREEN_EXIT', label: 'Fullscreen Exit', severity: 'MEDIUM' },
  { code: 'COPY_PASTE', label: 'Copy / Paste Attempt', severity: 'LOW' },
  { code: 'NO_FACE', label: 'No Face Detected', severity: 'HIGH' },
  { code: 'MULTIPLE_FACES', label: 'Multiple Faces', severity: 'HIGH' },
  { code: 'DEVTOOLS_OPEN', label: 'DevTools Opened', severity: 'CRITICAL' },
  { code: 'PHONE_DETECTED', label: 'Mobile Phone Detected', severity: 'HIGH' },
  { code: 'VOICE_DETECTED', label: 'Voice / Speech Detected', severity: 'MEDIUM' },
];

export interface HeatmapRowData {
  code: string;
  label: string;
  severity: string;
  counts: number[]; // 24 numbers (hours 0..23)
  total: number;
}

export interface HeatmapBucketRowData {
  code: string;
  label: string;
  severity: string;
  counts: number[]; // 6 numbers (4-hour buckets)
  total: number;
}

export interface HeatmapInsights {
  rowTotals: Record<string, number>;
  colTotals: number[]; // 24 elements
  grandTotal: number;
  peakHour: number; // 0..23
  peakHourFormatted: string;
  peakHourSimple: string;
  peakHourCount: number;
  quietestHour: number; // 0..23
  quietestHourFormatted: string;
  quietestHourSimple: string;
  quietestHourCount: number;
  mostFrequentViolationType: string;
  mostFrequentViolationCount: number;
  maxCellCount: number;
}

export interface HeatmapMatrixResult {
  rows: HeatmapRowData[];
  bucketRows: HeatmapBucketRowData[];
  insights: HeatmapInsights;
  bucketColTotals: number[]; // 6 elements
}

export const BUCKET_LABELS_6 = [
  '00-03h',
  '04-07h',
  '08-11h',
  '12-15h',
  '16-19h',
  '20-23h',
] as const;

export const BUCKET_DESCRIPTIONS_6 = [
  '12 AM – 3:59 AM',
  '4 AM – 7:59 AM',
  '8 AM – 11:59 AM',
  '12 PM – 3:59 PM',
  '4 PM – 7:59 PM',
  '8 PM – 11:59 PM',
] as const;

/**
 * Formats a 0-23 hour number into e.g. "16:00 (4 PM)"
 */
export function formatHour(hour: number): string {
  if (hour < 0 || hour > 23 || !Number.isInteger(hour)) {
    return `${hour}:00`;
  }
  const padded = String(hour).padStart(2, '0');
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${padded}:00 (${hour12} ${period})`;
}

/**
 * Formats a 0-23 hour into simple 12h format e.g. 0 -> "12 AM", 14 -> "2 PM"
 */
export function formatHourSimple(hour: number): string {
  if (hour < 0 || hour > 23 || !Number.isInteger(hour)) {
    return `${hour}:00`;
  }
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12} ${period}`;
}

/**
 * Returns a compact 3-hour label (12a, 3a, 6a, 9a, 12p, 3p, 6p, 9p)
 * for hours divisible by 3; empty string otherwise.
 */
export function formatHourCompact3h(hour: number): string {
  if (hour < 0 || hour > 23 || !Number.isInteger(hour) || hour % 3 !== 0) {
    return '';
  }
  const period = hour >= 12 ? 'p' : 'a';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}${period}`;
}

/**
 * Formats an hour into a range string: e.g. 14 -> "2 PM to 3 PM", 0 -> "12 AM to 1 AM"
 */
export function formatHourRange(hour: number): string {
  if (hour < 0 || hour > 23 || !Number.isInteger(hour)) {
    return `${hour}:00 to ${hour + 1}:00`;
  }
  const start = formatHourSimple(hour);
  const nextHour = (hour + 1) % 24;
  const end = formatHourSimple(nextHour);
  return `${start} to ${end}`;
}

/**
 * Pure function: Transforms raw heatmap records into a continuous 24-hour matrix,
 * 6 four-hour buckets, row/column/grand totals, and key circadian insights.
 */
export function buildHeatmapMatrix(
  records: RawHeatmapRecord[] = [],
  knownTypes: ViolationTypeMeta[] = KNOWN_VIOLATION_TYPES
): HeatmapMatrixResult {
  // 1. Gather all unique violation types (preserving known ordering, appending any dynamic types)
  const typesMap = new Map<string, { code: string; label: string; severity: string }>();

  // Seed with known types first for deterministic row ordering
  for (const t of knownTypes) {
    typesMap.set(t.code, { ...t });
  }

  // Add any additional types present in the records
  for (const r of records) {
    const code = String(r.violation_code ?? '').trim();
    if (!code) continue;
    if (!typesMap.has(code)) {
      typesMap.set(code, {
        code,
        label: r.violation_label || code,
        severity: r.severity || 'LOW',
      });
    } else if (r.violation_label) {
      // Update label/severity if provided
      const existing = typesMap.get(code)!;
      existing.label = r.violation_label;
      if (r.severity) existing.severity = r.severity;
    }
  }

  // 2. Initialize matrix structure (24 hours: 0..23)
  const rows: HeatmapRowData[] = Array.from(typesMap.values()).map((t) => ({
    code: t.code,
    label: t.label,
    severity: t.severity,
    counts: new Array(24).fill(0),
    total: 0,
  }));

  const rowIndexMap = new Map<string, number>();
  rows.forEach((row, idx) => rowIndexMap.set(row.code, idx));

  let maxCellCount = 0;

  // 3. Populate matrix with record counts
  for (const r of records) {
    const code = String(r.violation_code ?? '').trim();
    const rowIdx = rowIndexMap.get(code);
    const hour = Number(r.hour_of_day);
    const count = Number(r.violation_count ?? 0);

    if (rowIdx !== undefined && hour >= 0 && hour <= 23 && !Number.isNaN(count)) {
      rows[rowIdx].counts[hour] += count;
      if (rows[rowIdx].counts[hour] > maxCellCount) {
        maxCellCount = rows[rowIdx].counts[hour];
      }
    }
  }

  // 4. Compute row totals
  const rowTotals: Record<string, number> = {};
  for (const row of rows) {
    row.total = row.counts.reduce((sum, c) => sum + c, 0);
    rowTotals[row.code] = row.total;
  }

  // 5. Compute column totals (24 hours) & grand total
  const colTotals = new Array(24).fill(0);
  let grandTotal = 0;

  for (let h = 0; h < 24; h++) {
    let colSum = 0;
    for (const row of rows) {
      colSum += row.counts[h];
    }
    colTotals[h] = colSum;
    grandTotal += colSum;
  }

  // 6. Compute peak hour, quietest hour, most frequent violation
  let peakHour = 0;
  let peakHourCount = colTotals[0] ?? 0;
  let quietestHour = 0;
  let quietestHourCount = colTotals[0] ?? 0;

  for (let h = 0; h < 24; h++) {
    const cnt = colTotals[h];
    if (cnt > peakHourCount) {
      peakHourCount = cnt;
      peakHour = h;
    }
    if (cnt < quietestHourCount) {
      quietestHourCount = cnt;
      quietestHour = h;
    }
  }

  let mostFrequentViolationType = 'None';
  let mostFrequentViolationCount = 0;

  if (rows.length > 0) {
    let topRow = rows[0];
    for (const row of rows) {
      if (row.total > topRow.total) {
        topRow = row;
      }
    }
    if (topRow.total > 0) {
      mostFrequentViolationType = topRow.label;
      mostFrequentViolationCount = topRow.total;
    }
  }

  // 7. Aggregate into 6 four-hour buckets for mobile / compact screens
  const bucketRows: HeatmapBucketRowData[] = rows.map((row) => {
    const bucketCounts: number[] = [];
    for (let b = 0; b < 6; b++) {
      const sum =
        row.counts[b * 4] +
        row.counts[b * 4 + 1] +
        row.counts[b * 4 + 2] +
        row.counts[b * 4 + 3];
      bucketCounts.push(sum);
    }
    return {
      code: row.code,
      label: row.label,
      severity: row.severity,
      counts: bucketCounts,
      total: row.total,
    };
  });

  const bucketColTotals: number[] = [];
  for (let b = 0; b < 6; b++) {
    const sum =
      colTotals[b * 4] +
      colTotals[b * 4 + 1] +
      colTotals[b * 4 + 2] +
      colTotals[b * 4 + 3];
    bucketColTotals.push(sum);
  }

  const insights: HeatmapInsights = {
    rowTotals,
    colTotals,
    grandTotal,
    peakHour,
    peakHourFormatted: formatHour(peakHour),
    peakHourSimple: formatHourSimple(peakHour),
    peakHourCount,
    quietestHour,
    quietestHourFormatted: formatHour(quietestHour),
    quietestHourSimple: formatHourSimple(quietestHour),
    quietestHourCount,
    mostFrequentViolationType,
    mostFrequentViolationCount,
    maxCellCount,
  };

  return {
    rows,
    bucketRows,
    insights,
    bucketColTotals,
  };
}
