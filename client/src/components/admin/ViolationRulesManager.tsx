import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Copy,
  Maximize2,
  Mic,
  Minus,
  Monitor,
  Phone,
  Plus,
  RotateCcw,
  Scale,
  Sliders,
  Sparkles,
  Terminal,
  Users,
} from 'lucide-react';
import { SeverityBadge } from '../ui/SeverityBadge';
import { TrustRing } from '../ui/TrustRing';
import { Skeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/EmptyState';
import { api } from '../../lib/api';
import type { ViolationType } from '../../types/domain';

function getViolationIcon(code: string) {
  switch (code) {
    case 'PHONE_DETECTED':
      return <Phone className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    case 'VOICE_DETECTED':
      return <Mic className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    case 'MULTIPLE_FACES':
      return <Users className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    case 'NO_FACE':
      return <Camera className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    case 'TAB_SWITCH':
      return <Monitor className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    case 'FULLSCREEN_EXIT':
      return <Maximize2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
    case 'COPY_PASTE':
      return <Copy className="w-3.5 h-3.5 text-teal-400 shrink-0" />;
    case 'DEVTOOLS_OPEN':
      return <Terminal className="w-3.5 h-3.5 text-red-400 shrink-0" />;
    default:
      return <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
  }
}

export function ViolationRulesManager() {
  const queryClient = useQueryClient();

  // Local editing weights map (id -> penaltyPoints)
  const [editedWeights, setEditedWeights] = useState<Record<number, number>>({});
  const [saveSuccessId, setSaveSuccessId] = useState<number | null>(null);

  // Simulator State
  const [simulatorThreshold, setSimulatorThreshold] = useState<number>(50);
  const [simCounts, setSimCounts] = useState<Record<string, number>>({
    TAB_SWITCH: 2,
    FULLSCREEN_EXIT: 0,
    COPY_PASTE: 0,
    NO_FACE: 1,
    MULTIPLE_FACES: 0,
    DEVTOOLS_OPEN: 0,
    PHONE_DETECTED: 0,
    VOICE_DETECTED: 0,
  });

  // Query System Settings
  const settingsQuery = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => api.get<Record<string, string>>('/settings'),
  });

  const [localPhoneThreshold, setLocalPhoneThreshold] = useState<number | null>(null);
  const [saveThresholdSuccess, setSaveThresholdSuccess] = useState(false);

  const phoneThreshold =
    localPhoneThreshold ??
    (settingsQuery.data?.phone_confidence_threshold
      ? Number(settingsQuery.data.phone_confidence_threshold)
      : 0.6);

  const updateSettingMutation = useMutation({
    mutationFn: (val: number) =>
      api.patch('/settings', {
        key: 'phone_confidence_threshold',
        value: val.toFixed(2),
      }),
    onSuccess: () => {
      setSaveThresholdSuccess(true);
      setTimeout(() => setSaveThresholdSuccess(false), 2000);
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    },
  });

  // Query Violation Types from API
  const query = useQuery({
    queryKey: ['admin-violation-types'],
    queryFn: () => api.get<ViolationType[]>('/violation-types'),
  });

  const violationTypes = query.data ?? [];

  // Update penalty weight mutation
  const updateMutation = useMutation({
    mutationFn: (vars: { id: number; penaltyPoints: number }) =>
      api.patch(`/violation-types/${vars.id}`, { penaltyPoints: vars.penaltyPoints }),
    onSuccess: (_, vars) => {
      setSaveSuccessId(vars.id);
      setTimeout(() => setSaveSuccessId(null), 2000);
      queryClient.invalidateQueries({ queryKey: ['admin-violation-types'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
    },
  });

  const handleWeightChange = (id: number, val: number) => {
    setEditedWeights((prev) => ({ ...prev, [id]: Math.max(1, Math.min(100, val)) }));
  };

  const handleSaveWeight = (id: number, currentVal: number) => {
    const val = editedWeights[id] ?? currentVal;
    updateMutation.mutate({ id, penaltyPoints: val });
  };

  // Live Simulator Calculation
  let totalDeductions = 0;
  const infractionSummaryParts: string[] = [];

  violationTypes.forEach((vt) => {
    const count = simCounts[vt.code] ?? 0;
    const penalty = editedWeights[vt.id] ?? vt.penalty_points;
    if (count > 0) {
      totalDeductions += count * penalty;
      infractionSummaryParts.push(
        `${count} ${vt.label.toLowerCase()} (-${count * penalty} pts)`
      );
    }
  });

  const simulatedScore = Math.max(0, 100 - totalDeductions);
  const isTerminated = simulatedScore < simulatorThreshold;

  const handleUpdateSimCount = (code: string, delta: number) => {
    setSimCounts((prev) => ({
      ...prev,
      [code]: Math.max(0, (prev[code] ?? 0) + delta),
    }));
  };

  const handleResetSimulator = () => {
    setSimCounts({
      TAB_SWITCH: 2,
      FULLSCREEN_EXIT: 0,
      COPY_PASTE: 0,
      NO_FACE: 1,
      MULTIPLE_FACES: 0,
      DEVTOOLS_OPEN: 0,
      PHONE_DETECTED: 0,
      VOICE_DETECTED: 0,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & DATABASE TRIGGER INTEGRITY NOTE */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Scale className="w-5 h-5 text-brand" />
            <span>Authoritative Penalty Weight Engine (Violation_Types)</span>
          </h3>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">
            Database trigger <code className="text-brand font-mono">trg_before_violation_insert</code> dynamically reads these weights on every incident insert.
          </p>
        </div>

        <div className="rounded-xl border border-brand/20 bg-brand/5 px-3.5 py-2 text-xs font-mono text-brand shrink-0 flex items-center gap-2 font-medium">
          <Sparkles className="w-4 h-4" />
          <span>Dynamic DB-Backed Calibration</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 2. EDITABLE PENALTY WEIGHTS TABLE (left 7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
          {/* Instant Phone Detection Threshold Setting */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold font-mono text-foreground uppercase tracking-wide">
                  Instant Phone Detection Threshold
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-rose-400 px-2 py-0.5 rounded bg-rose-500/10">
                {(phoneThreshold * 100).toFixed(0)}% Confidence
              </span>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground">
              Single-frame neural trigger threshold (0.40 - 0.90). Penalizes immediately in 1 frame without waiting when score meets or exceeds this setting.
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.40"
                max="0.90"
                step="0.05"
                value={phoneThreshold}
                onChange={(e) => setLocalPhoneThreshold(parseFloat(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => updateSettingMutation.mutate(phoneThreshold)}
                disabled={updateSettingMutation.isPending}
                className="shrink-0 px-3 py-1 text-xs font-mono font-semibold rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {saveThresholdSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>Saved</span>
                  </>
                ) : updateSettingMutation.isPending ? (
                  <span>Saving...</span>
                ) : (
                  <span>Save</span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sliders className="w-4 h-4 text-violet-500" />
              <span>Configured Penalty Rules</span>
            </h4>
            <span className="text-[10px] font-mono text-muted-foreground">
              {violationTypes.length} Active Infraction Types
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-border bg-surface-elevated text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3">Infraction Type</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3 w-32 text-center">Penalty Points</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {query.isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`skel-${i}`}>
                      <td className="p-3 space-y-1">
                        <Skeleton className="h-4 w-28 rounded" />
                        <Skeleton className="h-3 w-40 rounded" />
                      </td>
                      <td className="p-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="p-3 text-center"><Skeleton className="h-7 w-20 mx-auto rounded-lg" /></td>
                      <td className="p-3 text-right"><Skeleton className="h-7 w-16 ml-auto rounded-lg" /></td>
                    </tr>
                  ))
                ) : query.isError ? (
                  <tr>
                    <td colSpan={4} className="p-8">
                      <ErrorState
                        title="Failed to Load Infraction Rules"
                        description="Could not read violation penalty weights from database. Please retry."
                        onRetry={() => query.refetch()}
                      />
                    </td>
                  </tr>
                ) : (
                  violationTypes.map((vt) => {
                  const currentPenalty = editedWeights[vt.id] ?? vt.penalty_points;
                  const isDirty = editedWeights[vt.id] !== undefined && editedWeights[vt.id] !== vt.penalty_points;
                  const isSaved = saveSuccessId === vt.id;

                  return (
                    <tr key={vt.id} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {getViolationIcon(vt.code)}
                          <div>
                            <span className="font-medium text-foreground">{vt.code}</span>
                            <div className="text-[10px] text-muted-foreground">{vt.label}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <SeverityBadge severity={vt.severity} size="sm" />
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={currentPenalty}
                            onChange={(e) => handleWeightChange(vt.id, Number(e.target.value))}
                            className="w-16 rounded-lg border border-border bg-background p-1.5 text-center text-xs text-foreground font-bold font-mono focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
                          />
                          <span className="text-muted-foreground text-[10px]">pts</span>
                        </div>
                      </td>

                      <td className="p-3 text-right">
                        {isSaved ? (
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Deployed
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!isDirty || updateMutation.isPending}
                            onClick={() => handleSaveWeight(vt.id, vt.penalty_points)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                              isDirty
                                ? 'bg-brand text-white hover:opacity-95 shadow-sm cursor-pointer'
                                : 'bg-muted text-muted-foreground/50 cursor-not-allowed border border-border'
                            }`}
                          >
                            Save
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. LIVE CHEATING SIMULATOR (right 5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand" />
                <span>Live Infraction Simulator</span>
              </h4>
              <p className="text-[11px] font-mono text-muted-foreground">
                Interactive real-time trust penalty simulator
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetSimulator}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          {/* Simulated Score Gauge + Status */}
          <div className="rounded-xl border border-border bg-surface-elevated p-4 flex items-center justify-between gap-4">
            <TrustRing
              score={simulatedScore}
              minThreshold={simulatorThreshold}
              size="md"
              sublabel="Simulated"
            />

            <div className="flex-1 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Initial Score:</span>
                <span className="text-foreground font-bold">100%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Deducted:</span>
                <span className="text-rose-500 font-bold">-{totalDeductions} PTS</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1">
                <span className="text-muted-foreground">Resulting Score:</span>
                <span
                  className={`font-bold tabular-nums ${
                    isTerminated ? 'text-rose-500' : simulatedScore < 85 ? 'text-amber-500' : 'text-emerald-500'
                  }`}
                >
                  {simulatedScore}%
                </span>
              </div>
              <div className="pt-1 flex items-center justify-between">
                {isTerminated ? (
                  <span className="inline-block rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-500 animate-pulse">
                    TERMINATED_CHEATING
                  </span>
                ) : (
                  <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    SESSION ACTIVE
                  </span>
                )}
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>Threshold:</span>
                  <input
                    type="range"
                    min={20}
                    max={80}
                    step={5}
                    value={simulatorThreshold}
                    onChange={(e) => setSimulatorThreshold(Number(e.target.value))}
                    className="w-16 accent-brand cursor-pointer"
                  />
                  <span className="text-brand font-bold">{simulatorThreshold}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Simulation Summary Statement */}
          <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 text-xs font-mono text-brand leading-relaxed">
            💡 <strong>Live Calibration Preview:</strong>{' '}
            <span className="text-foreground">
              {infractionSummaryParts.length > 0
                ? `A student with ${infractionSummaryParts.join(' and ')} ends at ${simulatedScore}%.`
                : 'A student with 0 violations remains at 100% (Clean).'}
            </span>
          </div>

          {/* Violation Stepper Counters */}
          <div className="space-y-2.5 font-mono text-xs">
            <label className="block text-foreground font-semibold text-[11px] uppercase tracking-wider">
              Simulate Candidate Violations
            </label>
            {violationTypes.map((vt) => {
              const count = simCounts[vt.code] ?? 0;
              const penalty = editedWeights[vt.id] ?? vt.penalty_points;

              return (
                <div
                  key={vt.code}
                  className="flex items-center justify-between rounded-xl border border-border bg-background p-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2 truncate">
                    {getViolationIcon(vt.code)}
                    <span className="font-medium text-foreground truncate">{vt.code}</span>
                    <span className="text-[10px] text-rose-500 shrink-0 font-semibold">(-{penalty} pts)</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateSimCount(vt.code, -1)}
                      className="h-7 w-7 rounded-lg border border-border bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center font-bold text-foreground tabular-nums">{count}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateSimCount(vt.code, 1)}
                      className="h-7 w-7 rounded-lg border border-border bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
