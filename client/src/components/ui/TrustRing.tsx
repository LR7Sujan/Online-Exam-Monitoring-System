import { useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TrustRingProps {
  score: number;
  minThreshold?: number;
  size?: number | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showThresholdMarker?: boolean;
  sublabel?: string;
  className?: string;
}

const sizeMap = {
  sm: 96,
  md: 144,
  lg: 192,
};

interface Particle {
  id: number;
  angle: number;
  distance: number;
  color: string;
  size: number;
}

export function TrustRing({
  score,
  minThreshold = 70,
  size = 'md',
  showLabel = true,
  showThresholdMarker = true,
  sublabel,
  className = '',
}: TrustRingProps) {
  const uniqueId = useId().replace(/:/g, '');
  const pixelSize = typeof size === 'number' ? size : sizeMap[size];
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const strokeWidth = pixelSize > 120 ? 10 : 7;
  const radius = (pixelSize - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const isDanger = clamped < minThreshold;
  const isWarning = !isDanger && clamped < 80;

  // Gradient configuration based on risk tier
  const gradientId = `trust-grad-${uniqueId}`;
  let stopColor1 = '#10B981'; // Emerald
  let stopColor2 = '#22D3EE'; // Cyan
  let primaryColor = '#10B981';

  if (isDanger) {
    stopColor1 = '#F43F5E'; // Magenta
    stopColor2 = '#BE123C'; // Ruby Red
    primaryColor = '#F43F5E';
  } else if (isWarning) {
    stopColor1 = '#F59E0B'; // Amber
    stopColor2 = '#FB923C'; // Orange
    primaryColor = '#F59E0B';
  }

  // Glow intensifies as score drops (from 6px at 100% to 26px at critical low)
  const scoreDrop = 100 - clamped;
  const glowRadius = Math.round(6 + scoreDrop * 0.2);
  const glowAlpha = Math.min(0.95, 0.4 + scoreDrop * 0.0055);

  // Particle burst on score restoration
  const prevScoreRef = useRef(clamped);
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Score restored (increased by at least 2 points)
    if (clamped > prevScoreRef.current + 1) {
      const sparkColors = ['#10B981', '#22D3EE', '#FBBF24', '#34D399', '#67E8F9'];
      const burstCount = 18;
      const newParticles: Particle[] = Array.from({ length: burstCount }, (_, i) => {
        const angle = (i / burstCount) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
        const distance = radius * 0.85 + Math.random() * (radius * 0.9);
        return {
          id: Date.now() + i,
          angle,
          distance,
          color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
          size: Math.random() * 3.5 + 2.5,
        };
      });
      setParticles(newParticles);
      const timer = setTimeout(() => setParticles([]), 900);
      return () => clearTimeout(timer);
    }
    prevScoreRef.current = clamped;
  }, [clamped, radius]);

  const thresholdAngle = (minThreshold / 100) * 360 - 90;
  const thresholdRad = (thresholdAngle * Math.PI) / 180;
  const markerX = pixelSize / 2 + radius * Math.cos(thresholdRad);
  const markerY = pixelSize / 2 + radius * Math.sin(thresholdRad);

  return (
    <div
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Trust Score: ${clamped}%`}
      className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}
    >
      {/* Critical intensified pulsing aura when below threshold */}
      {isDanger && (
        <motion.div
          animate={{
            scale: [1, 1.18, 1],
            opacity: [0.35, 0.75, 0.35],
          }}
          transition={{
            duration: 1.3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute inset-0 rounded-full bg-magenta/25 blur-2xl pointer-events-none"
        />
      )}

      {/* SVG Ring with Gradient Stroke & Dynamic Glow */}
      <svg
        width={pixelSize}
        height={pixelSize}
        className="-rotate-90 overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={stopColor1} />
            <stop offset="100%" stopColor={stopColor2} />
          </linearGradient>
        </defs>

        {/* Track */}
        <circle
          cx={pixelSize / 2}
          cy={pixelSize / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
        />

        {/* Foreground Animated Gradient Stroke with Intensifying Glow */}
        <motion.circle
          cx={pixelSize / 2}
          cy={pixelSize / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          style={{
            filter: `drop-shadow(0 0 ${glowRadius}px ${primaryColor}${Math.round(glowAlpha * 255).toString(16).padStart(2, '0')})`,
          }}
        />

        {/* Minimum Threshold Marker */}
        {showThresholdMarker && (
          <circle
            cx={markerX}
            cy={markerY}
            r={strokeWidth * 0.45}
            fill="#F43F5E"
            stroke="#0A0B14"
            strokeWidth={2}
          />
        )}
      </svg>

      {/* Score Restoration Particle Burst */}
      <AnimatePresence>
        {particles.length > 0 && (
          <div
            className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible"
            aria-hidden="true"
          >
            {particles.map((p) => {
              const targetX = Math.cos(p.angle) * p.distance;
              const targetY = Math.sin(p.angle) * p.distance;
              return (
                <motion.span
                  key={p.id}
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={{
                    x: targetX,
                    y: targetY,
                    scale: [0, 1.4, 0],
                    opacity: [1, 0.9, 0],
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{
                    backgroundColor: p.color,
                    width: p.size,
                    height: p.size,
                    boxShadow: `0 0 10px ${p.color}`,
                  }}
                  className="absolute rounded-full"
                />
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* Center Metrics Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
        {showLabel && pixelSize > 100 && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Trust Score
          </span>
        )}

        <div className="flex items-baseline justify-center">
          <motion.span
            key={clamped}
            initial={{ scale: 0.92, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="telemetry-num font-bold tracking-tight"
            style={{
              color: primaryColor,
              fontSize: pixelSize > 140 ? '2.25rem' : pixelSize > 100 ? '1.5rem' : '1.1rem',
              lineHeight: 1,
            }}
          >
            {clamped}
          </motion.span>
          <span
            className="font-mono text-slate-400 ml-0.5"
            style={{ fontSize: pixelSize > 140 ? '0.875rem' : '0.75rem' }}
          >
            %
          </span>
        </div>

        {sublabel ? (
          <span className="text-[10px] text-slate-400 truncate max-w-[80%]">
            {sublabel}
          </span>
        ) : (
          pixelSize > 120 && (
            <span className="font-mono text-[10px] text-slate-400 mt-0.5">
              LIMIT {minThreshold}%
            </span>
          )
        )}
      </div>
    </div>
  );
}

// Backward compatibility alias
export const TrustGauge = TrustRing;
