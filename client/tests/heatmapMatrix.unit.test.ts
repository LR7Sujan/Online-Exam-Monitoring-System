import { describe, it, expect } from 'vitest';
import {
  buildHeatmapMatrix,
  formatHour,
  formatHourSimple,
  formatHourCompact3h,
  formatHourRange,
  KNOWN_VIOLATION_TYPES,
  type RawHeatmapRecord,
} from '../src/utils/heatmapMatrix.js';

const assert = {
  equal: (a: unknown, b: unknown) => expect(a).toEqual(b),
  ok: (a: unknown) => expect(a).toBeTruthy(),
};

describe('Circadian Incident Heatmap Matrix Helper (buildHeatmapMatrix)', () => {
  it('handles empty records by generating a 24-hour zero-filled matrix and 6 zero-filled buckets', () => {
    const result = buildHeatmapMatrix([]);

    assert.equal(result.rows.length, KNOWN_VIOLATION_TYPES.length);
    assert.equal(result.bucketRows.length, KNOWN_VIOLATION_TYPES.length);
    assert.equal(result.insights.grandTotal, 0);
    assert.equal(result.insights.maxCellCount, 0);
    assert.equal(result.insights.mostFrequentViolationType, 'None');
    assert.equal(result.insights.peakHourCount, 0);
    assert.equal(result.insights.quietestHourCount, 0);

    for (const row of result.rows) {
      assert.equal(row.counts.length, 24);
      assert.ok(row.counts.every((c) => c === 0));
      assert.equal(row.total, 0);
    }

    for (const brow of result.bucketRows) {
      assert.equal(brow.counts.length, 6);
      assert.ok(brow.counts.every((c) => c === 0));
      assert.equal(brow.total, 0);
    }

    assert.equal(result.insights.colTotals.length, 24);
    assert.ok(result.insights.colTotals.every((c) => c === 0));
    assert.equal(result.bucketColTotals.length, 6);
    assert.ok(result.bucketColTotals.every((c) => c === 0));
  });

  it('correctly maps records to hour columns and fills missing cells with 0', () => {
    const mockRecords: RawHeatmapRecord[] = [
      {
        hour_of_day: 3,
        violation_code: 'TAB_SWITCH',
        violation_label: 'Tab / Window Switch',
        severity: 'MEDIUM',
        violation_count: 5,
      },
      {
        hour_of_day: 14,
        violation_code: 'TAB_SWITCH',
        violation_label: 'Tab / Window Switch',
        severity: 'MEDIUM',
        violation_count: 3,
      },
      {
        hour_of_day: 14,
        violation_code: 'COPY_PASTE',
        violation_label: 'Copy / Paste Attempt',
        severity: 'LOW',
        violation_count: 10,
      },
    ];

    const result = buildHeatmapMatrix(mockRecords);

    const tabRow = result.rows.find((r) => r.code === 'TAB_SWITCH')!;
    assert.ok(tabRow);
    assert.equal(tabRow.counts[3], 5);
    assert.equal(tabRow.counts[14], 3);
    assert.equal(tabRow.counts[0], 0); // Missing cell is 0
    assert.equal(tabRow.counts[1], 0);
    assert.equal(tabRow.total, 8); // 5 + 3

    const copyRow = result.rows.find((r) => r.code === 'COPY_PASTE')!;
    assert.ok(copyRow);
    assert.equal(copyRow.counts[14], 10);
    assert.equal(copyRow.total, 10);

    // Column totals
    assert.equal(result.insights.colTotals[3], 5);
    assert.equal(result.insights.colTotals[14], 13); // 3 + 10
    assert.equal(result.insights.colTotals[0], 0);
    assert.equal(result.insights.grandTotal, 18);
  });

  it('computes insights accurately: peak hour, quietest hour, most frequent violation, and max cell', () => {
    const mockRecords: RawHeatmapRecord[] = [
      { hour_of_day: 2, violation_code: 'FULLSCREEN_EXIT', violation_count: 4 },
      { hour_of_day: 16, violation_code: 'TAB_SWITCH', violation_count: 25 },
      { hour_of_day: 16, violation_code: 'DEVTOOLS_OPEN', violation_count: 5 },
      { hour_of_day: 22, violation_code: 'NO_FACE', violation_count: 2 },
    ];

    const result = buildHeatmapMatrix(mockRecords);

    assert.equal(result.insights.grandTotal, 36);
    assert.equal(result.insights.maxCellCount, 25);
    assert.equal(result.insights.peakHour, 16);
    assert.equal(result.insights.peakHourCount, 30); // 25 + 5
    assert.equal(result.insights.peakHourFormatted, '16:00 (4 PM)');
    assert.equal(result.insights.mostFrequentViolationType, 'Tab / Window Switch');
    assert.equal(result.insights.mostFrequentViolationCount, 25);
    // Hours other than 2, 16, 22 have 0 incidents -> quietest hour should be hour 0 with 0 count
    assert.equal(result.insights.quietestHour, 0);
    assert.equal(result.insights.quietestHourCount, 0);
  });

  it('aggregates into 6 four-hour buckets for compact/mobile view', () => {
    const mockRecords: RawHeatmapRecord[] = [
      { hour_of_day: 0, violation_code: 'COPY_PASTE', violation_count: 2 }, // bucket 0 (00-03h)
      { hour_of_day: 3, violation_code: 'COPY_PASTE', violation_count: 3 }, // bucket 0 (00-03h)
      { hour_of_day: 5, violation_code: 'COPY_PASTE', violation_count: 7 }, // bucket 1 (04-07h)
      { hour_of_day: 8, violation_code: 'COPY_PASTE', violation_count: 4 }, // bucket 2 (08-11h)
      { hour_of_day: 15, violation_code: 'COPY_PASTE', violation_count: 6 }, // bucket 3 (12-15h)
      { hour_of_day: 18, violation_code: 'COPY_PASTE', violation_count: 8 }, // bucket 4 (16-19h)
      { hour_of_day: 23, violation_code: 'COPY_PASTE', violation_count: 5 }, // bucket 5 (20-23h)
    ];

    const result = buildHeatmapMatrix(mockRecords);
    const copyBucket = result.bucketRows.find((r) => r.code === 'COPY_PASTE')!;
    assert.ok(copyBucket);

    assert.equal(copyBucket.counts[0], 5); // 2 + 3
    assert.equal(copyBucket.counts[1], 7);
    assert.equal(copyBucket.counts[2], 4);
    assert.equal(copyBucket.counts[3], 6);
    assert.equal(copyBucket.counts[4], 8);
    assert.equal(copyBucket.counts[5], 5);
    assert.equal(copyBucket.total, 35); // 5+7+4+6+8+5

    // Bucket column totals
    assert.equal(result.bucketColTotals[0], 5);
    assert.equal(result.bucketColTotals[1], 7);
    assert.equal(result.bucketColTotals[2], 4);
    assert.equal(result.bucketColTotals[3], 6);
    assert.equal(result.bucketColTotals[4], 8);
    assert.equal(result.bucketColTotals[5], 5);
    assert.equal(
      result.bucketColTotals.reduce((a, b) => a + b, 0),
      result.insights.grandTotal
    );
  });

  it('dynamically registers unknown violation types from records', () => {
    const customRecords: RawHeatmapRecord[] = [
      {
        hour_of_day: 10,
        violation_code: 'EXTERNAL_DISPLAY',
        violation_label: 'External Display Attached',
        severity: 'CRITICAL',
        violation_count: 4,
      },
    ];

    const result = buildHeatmapMatrix(customRecords);
    const customRow = result.rows.find((r) => r.code === 'EXTERNAL_DISPLAY')!;
    assert.ok(customRow);
    assert.equal(customRow.label, 'External Display Attached');
    assert.equal(customRow.severity, 'CRITICAL');
    assert.equal(customRow.counts[10], 4);
    assert.equal(customRow.total, 4);
    assert.equal(result.insights.grandTotal, 4);
  });

  it('formats hours properly across 24h boundaries with AM/PM labels', () => {
    assert.equal(formatHour(0), '00:00 (12 AM)');
    assert.equal(formatHour(1), '01:00 (1 AM)');
    assert.equal(formatHour(9), '09:00 (9 AM)');
    assert.equal(formatHour(11), '11:00 (11 AM)');
    assert.equal(formatHour(12), '12:00 (12 PM)');
    assert.equal(formatHour(14), '14:00 (2 PM)');
    assert.equal(formatHour(16), '16:00 (4 PM)');
    assert.equal(formatHour(23), '23:00 (11 PM)');
    assert.equal(formatHour(24), '24:00'); // Out of bounds fallback
  });

  it('formats compact 3-hour labels, simple hours, and hourly ranges', () => {
    // formatHourSimple
    assert.equal(formatHourSimple(0), '12 AM');
    assert.equal(formatHourSimple(14), '2 PM');
    assert.equal(formatHourSimple(16), '4 PM');
    assert.equal(formatHourSimple(23), '11 PM');

    // formatHourCompact3h: 12a, 3a, 6a, 9a, 12p, 3p, 6p, 9p
    assert.equal(formatHourCompact3h(0), '12a');
    assert.equal(formatHourCompact3h(1), '');
    assert.equal(formatHourCompact3h(2), '');
    assert.equal(formatHourCompact3h(3), '3a');
    assert.equal(formatHourCompact3h(6), '6a');
    assert.equal(formatHourCompact3h(9), '9a');
    assert.equal(formatHourCompact3h(12), '12p');
    assert.equal(formatHourCompact3h(15), '3p');
    assert.equal(formatHourCompact3h(18), '6p');
    assert.equal(formatHourCompact3h(21), '9p');
    assert.equal(formatHourCompact3h(22), '');

    // formatHourRange
    assert.equal(formatHourRange(0), '12 AM to 1 AM');
    assert.equal(formatHourRange(14), '2 PM to 3 PM');
    assert.equal(formatHourRange(23), '11 PM to 12 AM');
  });
});
