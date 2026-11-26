import { motion } from 'framer-motion';

interface TrustGaugeProps {
  score: number;
  minThreshold: number;
  size?: number;
}

export function TrustGauge({ score, minThreshold, size = 156 }: TrustGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const isDanger = clamped < minThreshold;
  const isWarning = !isDanger && clamped < 80;

  const strokeColor = isDanger
    ? '#F43F5E'
    : isWarning
      ? '#F59E0B'
      : clamped === 100
        ? '#10B981'
        : '#22D3EE';

  const thresholdAngle = (minThreshold / 100) * 360 - 90;
  const thresholdRad = (thresholdAngle * Math.PI) / 180;
  const markerX = size / 2 + radius * Math.cos(thresholdRad);
  const markerY = size / 2 + radius * Math.sin(thresholdRad);

  return (
    <div className="relative inline-flex flex-col items-center justify-center">
      <svg width={size} height={size} className="-rotate-90 overflow-visible">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{
            filter: `drop-shadow(0 0 8px ${strokeColor}66)`,
          }}
        />
        {/* Threshold marker */}
        <circle
          cx={markerX}
          cy={markerY}
          r={4.5}
          fill="#F43F5E"
          stroke="var(--surface)"
          strokeWidth={2}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Trust Index
        </span>
        <span
          className="telemetry-num text-3xl font-bold"
          style={{ color: strokeColor }}
        >
          {clamped}%
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          MIN {minThreshold}%
        </span>
      </div>
    </div>
  );
}

