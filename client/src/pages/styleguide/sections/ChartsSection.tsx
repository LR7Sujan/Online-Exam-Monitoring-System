import { SectionDocPage } from '../SectionDocPage';
import { ComponentPreview } from '../ComponentPreview';
import { GlassCard } from '../../../components/ui';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartTooltip, useChartTheme } from '../../../components/charts/shared';

export function ChartsSection() {
  const chartTheme = useChartTheme();

  const chartData = [
    { name: 'Earned Score', value: 75, color: '#10B981' },
    { name: 'Marks Deducted', value: 25, color: '#F43F5E' },
  ];
  const total = 100;
  const score = 75;

  const barData = [
    { category: 'Clean', count: 28, fill: chartTheme.series.emerald },
    { category: 'Flagged', count: 12, fill: chartTheme.series.amber },
    { category: 'Disqualified', count: 3, fill: chartTheme.series.rose },
  ];

  const toc = [
    { id: 'donut-chart', label: 'Donut Score Breakdown' },
    { id: 'tooltip-legend', label: 'Tooltip & Subtle Cursor Standards' },
  ];

  return (
    <SectionDocPage slug="charts" toc={toc}>
      <ComponentPreview
        id="donut-chart"
        title="Donut / Pie Chart with Offset Tooltip"
        description="Authoritative Recharts configuration: fixed offset tooltip that never obscures the center score, rounded caps, and dual-theme solid surface styling."
        badge="Recharts"
        code={`import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

<div className="w-44 h-44 relative">
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie
        data={chartData}
        dataKey="value"
        cx="50%"
        cy="50%"
        innerRadius={46}
        outerRadius={66}
        paddingAngle={4}
        cornerRadius={6}
      >
        {chartData.map((entry, index) => (
          <Cell key={index} fill={entry.color} />
        ))}
      </Pie>
      <Tooltip offset={24} content={<CustomTooltip />} />
    </PieChart>
  </ResponsiveContainer>
  <div className="absolute inset-0 flex flex-col items-center justify-center">
    <span className="text-2xl font-bold font-mono">75</span>
    <span className="text-[10px] font-mono text-muted-foreground uppercase">PTS</span>
  </div>
</div>`}
      >
        <GlassCard className="p-8 flex flex-col sm:flex-row items-center justify-around gap-8 w-full">
          <div className="w-48 h-48 relative shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={4}
                  cornerRadius={6}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  {...chartTheme.tooltipProps}
                  offset={24}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      const val = Number(data.value ?? 0);
                      const pct = Math.round((val / total) * 100);
                      const color = (data.payload as { color?: string })?.color ?? chartTheme.series.emerald;
                      return (
                        <ChartTooltip
                          active={active}
                          payload={[
                            {
                              name: data.name,
                              value: `${val} PTS`,
                              color,
                              payload: { percent: pct },
                            },
                          ]}
                          showPercent
                        />
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center score label (large bold tabular number + PTS caption) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
              <span className="text-3xl font-extrabold font-mono tracking-tight tabular-nums text-foreground leading-none">
                {score}
              </span>
              <span className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase mt-1">
                PTS
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Score Composition</h4>
            <div className="space-y-2 text-sm font-sans">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-foreground font-medium">Earned 75 (75%)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                <span className="text-foreground font-medium">Lost 25 (25%)</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs pt-1">
              Hover over either slice to inspect the 13px sans-serif solid tooltip offset from the center score.
            </p>
          </div>
        </GlassCard>
      </ComponentPreview>

      <ComponentPreview
        id="tooltip-legend"
        title="Subtle Hover Cursor & Bar Chart Tooltip"
        description="Standardized chart helper layer featuring solid var(--surface) background, 12px radius, 13px sans-serif typography, and subtle indigo cursor replacing the default light-gray hover block."
        badge="BarChart"
        code={`import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { ChartTooltip, useChartTheme } from '@/components/charts/shared';

const theme = useChartTheme();

<BarChart data={barData}>
  <CartesianGrid strokeDasharray="3 3" stroke={theme.gridlines} />
  <XAxis dataKey="category" stroke={theme.axisLine} tick={{ fill: theme.axisText }} />
  <YAxis stroke={theme.axisLine} tick={{ fill: theme.axisText }} />
  <Tooltip
    {...theme.barTooltipProps}
    content={<ChartTooltip />}
  />
  <Bar dataKey="count" fill={theme.series.indigo} />
</BarChart>`}
      >
        <div className="p-6 rounded-2xl border border-border bg-surface shadow-bento w-full">
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridlines} opacity={0.6} vertical={false} />
                <XAxis dataKey="category" stroke={chartTheme.axisLine} tick={{ fill: chartTheme.axisText, fontSize: 11, fontFamily: 'sans-serif' }} tickLine={false} />
                <YAxis stroke={chartTheme.axisLine} tick={{ fill: chartTheme.axisText, fontSize: 11, fontFamily: 'sans-serif' }} tickLine={false} />
                <Tooltip
                  {...chartTheme.barTooltipProps}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <ChartTooltip
                          active={active}
                          title={`Status: ${item.category}`}
                          payload={[
                            {
                              name: 'Candidates',
                              value: item.count,
                              color: item.fill,
                            },
                          ]}
                        />
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" name="Candidates" radius={[6, 6, 0, 0]}>
                  {barData.map((entry, idx) => (
                    <Cell key={`bar-${idx}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </ComponentPreview>
    </SectionDocPage>
  );
}
