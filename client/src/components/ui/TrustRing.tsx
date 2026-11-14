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

  // Gradient configuration based on risk tier: emerald -> amber -> rose
  const gradientId = `trust-grad-${uniqueId}`;
  let stopColor1 = '#10B981'; // Emerald
  let stopColor2 = '#34D399';
  let primaryColor = '#10B981';

  if (isDanger) {
    stopColor1 = '#F43F5E'; // Rose
    stopColor2 = '#BE123C';
    primaryColor = '#F43F5E';
  } else if (isWarning) {
    stopColor1 = '#F59E0B'; // Amber
    stopColor2 = '#FBBF24';
    primaryColor = '#F59E0B';
  }

  // Glow intensifies as score drops (from 4px at 100% to 24px at critical low)
  const scoreDrop = 100 - clamped;
  const glowRadius = Math.round(4 + scoreDrop * 0.2);
  const glowAlpha = Math.min(0.85, 0.3 + scoreDrop * 0.005);

  // Particle burst on score restoration
  const prevScoreRef = useRef(clamped);
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Score restored (increased by at least 2 points)
    if (clamped > prevScoreRef.current + 1) {
      const sparkColors = ['#10B981', '#34D399', '#6366F1', '#8B5CF6', '#FBBF24'];
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

  const valueText = isDanger
    ? `Critical: ${clamped}%, below minimum threshold of ${minThreshold}%`
    : isWarning
      ? `Warning: ${clamped}%`
      : `Good: ${clamped}%`;

  return (
    <div
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText}
      aria-label={`Trust Score: ${clamped}%`}
      className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}
    >
      {/* Critical intensified pulsing aura when below threshold */}
      {isDanger && (
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute inset-0 rounded-full bg-rose-500/20 blur-xl pointer-events-none"
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
          stroke="currentColor"
          className="text-zinc-200 dark:text-zinc-800"
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
          transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
          style={{
            filter: `drop-shadow(0 0 ${glowRadius}px ${primaryColor}${Math.round(
              glowAlpha * 255
            ).toString(16).padStart(2, '0')})`,
          }}
        />

        {/* Optional Min Threshold Marker */}
        {showThresholdMarker && (
          <g>
            <circle
              cx={markerX}
              cy={markerY}
              r={strokeWidth / 2 + 1}
              fill="#F43F5E"
              stroke="white"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>

      {/* Center Readout */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="flex items-baseline">
            <span
              className={`font-mono font-bold tracking-tight tabular-nums text-foreground ${
                pixelSize > 120 ? 'text-3xl' : 'text-xl'
              }`}
            >
              {clamped}
            </span>
            <span
              className={`font-mono text-muted-foreground ml-0.5 font-medium ${
                pixelSize > 120 ? 'text-sm' : 'text-[10px]'
              }`}
            >
              %
            </span>
          </div>

          {sublabel && (
            <span
              className={`font-mono uppercase tracking-wider text-muted-foreground mt-0.5 ${
                pixelSize > 120 ? 'text-[10px]' : 'text-[8px]'
              }`}
            >
              {sublabel}
            </span>
          )}
        </div>
      )}

      {/* Particle Restoration Burst Animation */}
      <AnimatePresence>
        {particles.map((p) => {
          const x = pixelSize / 2 + p.distance * Math.cos(p.angle);
          const y = pixelSize / 2 + p.distance * Math.sin(p.angle);
          return (
            <motion.div
              key={p.id}
              initial={{
                x: pixelSize / 2,
                y: pixelSize / 2,
                scale: 0.2,
                opacity: 1,
              }}
              animate={{
                x,
                y,
                scale: [0.2, 1.3, 0],
                opacity: [1, 0.9, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.size,
                borderRadius: '9999px',
                backgroundColor: p.color,
                boxShadow: `0 0 8px ${p.color}`,
                pointerEvents: 'none',
              }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
