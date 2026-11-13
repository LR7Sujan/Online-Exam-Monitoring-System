import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Minus,
  Plus,
  RotateCcw,
  Scale,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { SeverityBadge } from '../ui/SeverityBadge';
import { TrustRing } from '../ui/TrustRing';
import { api } from '../../lib/api';
import type { ViolationType } from '../../types/domain';

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
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & DATABASE TRIGGER INTEGRITY NOTE */}
      <div className="rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-5 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-cyan" />
            <span>Authoritative Penalty Weight Engine (Violation_Types)</span>
          </h3>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            Database trigger <code className="text-cyan">trg_before_violation_insert</code> dynamically reads these weights on every incident insert.
          </p>
        </div>

        <div className="rounded-xl border border-cyan/30 bg-cyan/10 px-3.5 py-2 text-xs font-mono text-cyan shrink-0 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>Dynamic DB-Backed Calibration</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 2. EDITABLE PENALTY WEIGHTS TABLE (left 7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-5 backdrop-blur-xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-violet" />
              <span>Configured Penalty Rules</span>
            </h4>
            <span className="text-[10px] font-mono text-slate-400">
              {violationTypes.length} Active Infraction Types
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-white/10 bg-[#121528] text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="p-3">Infraction Type</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3 w-32 text-center">Penalty Points</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {violationTypes.map((vt) => {
                  const currentPenalty = editedWeights[vt.id] ?? vt.penalty_points;
                  const isDirty = editedWeights[vt.id] !== undefined && editedWeights[vt.id] !== vt.penalty_points;
                  const isSaved = saveSuccessId === vt.id;

                  return (
                    <tr key={vt.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3">
                        <span className="font-bold text-white">{vt.code}</span>
                        <div className="text-[10px] text-slate-400">{vt.label}</div>
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
                            className="w-16 rounded-lg border border-white/10 bg-[#070812] p-1.5 text-center text-xs text-white font-bold font-mono focus:border-cyan focus:outline-none"
                          />
                          <span className="text-slate-400 text-[10px]">pts</span>
                        </div>
                      </td>

                      <td className="p-3 text-right">
                        {isSaved ? (
                          <span className="text-[11px] font-bold text-emerald flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Deployed
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!isDirty || updateMutation.isPending}
                            onClick={() => handleSaveWeight(vt.id, vt.penalty_points)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                              isDirty
                                ? 'bg-cyan text-void hover:bg-cyan-300 shadow-glow-cyan-sm'
                                : 'bg-white/5 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            Save
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. LIVE CHEATING SIMULATOR (right 5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-5 backdrop-blur-xl shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan" />
                <span>Live Infraction Simulator</span>
              </h4>
              <p className="text-[11px] font-mono text-slate-400">
                Interactive real-time trust penalty simulator
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetSimulator}
              className="text-[10px] font-mono text-slate-400 hover:text-white flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          {/* Simulated Score Gauge + Status */}
          <div className="rounded-xl border border-white/10 bg-[#080914] p-4 flex items-center justify-between gap-4">
            <TrustRing
              score={simulatedScore}
              minThreshold={simulatorThreshold}
              size={80}
              sublabel="Simulated"
            />

            <div className="flex-1 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Initial Score:</span>
                <span className="text-white font-bold">100%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Deducted:</span>
                <span className="text-magenta font-bold">-{totalDeductions} PTS</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-1">
                <span className="text-slate-400">Resulting Score:</span>
                <span
                  className={`font-bold ${
                    isTerminated ? 'text-magenta' : simulatedScore < 85 ? 'text-amber' : 'text-emerald'
                  }`}
                >
                  {simulatedScore}%
                </span>
              </div>
              <div className="pt-1 flex items-center justify-between">
                {isTerminated ? (
                  <span className="inline-block rounded-full border border-magenta/50 bg-magenta/20 px-2 py-0.5 text-[10px] font-bold text-magenta animate-pulse shadow-glow-magenta-sm">
                    TERMINATED_CHEATING
                  </span>
                ) : (
                  <span className="inline-block rounded-full border border-emerald/40 bg-emerald/15 px-2 py-0.5 text-[10px] font-bold text-emerald">
                    SESSION ACTIVE
                  </span>
                )}
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span>Threshold:</span>
                  <input
                    type="range"
                    min={20}
                    max={80}
                    step={5}
                    value={simulatorThreshold}
                    onChange={(e) => setSimulatorThreshold(Number(e.target.value))}
                    className="w-16 accent-cyan cursor-pointer"
                  />
                  <span className="text-cyan font-bold">{simulatorThreshold}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Simulation Summary Statement */}
          <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-3 text-xs font-mono text-cyan leading-relaxed">
            💡 <strong>Live Calibration Preview:</strong>{' '}
            <span className="text-slate-200">
              {infractionSummaryParts.length > 0
                ? `A student with ${infractionSummaryParts.join(' and ')} ends at ${simulatedScore}%.`
                : 'A student with 0 violations remains at 100% (Clean).'}
            </span>
          </div>

          {/* Violation Stepper Counters */}
          <div className="space-y-2.5 font-mono text-xs">
            <label className="block text-slate-300 font-bold text-[11px] uppercase tracking-wider">
              Simulate Candidate Violations
            </label>
            {violationTypes.map((vt) => {
              const count = simCounts[vt.code] ?? 0;
              const penalty = editedWeights[vt.id] ?? vt.penalty_points;

              return (
                <div
                  key={vt.code}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-[#070914] p-2.5"
                >
                  <div className="min-w-0 pr-2 truncate">
                    <span className="font-bold text-white">{vt.code}</span>
                    <span className="text-[10px] text-magenta ml-1.5">(-{penalty} pts)</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateSimCount(vt.code, -1)}
                      className="h-7 w-7 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-slate-300 hover:bg-white/10"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center font-bold text-white">{count}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateSimCount(vt.code, 1)}
                      className="h-7 w-7 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-slate-300 hover:bg-white/10"
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
