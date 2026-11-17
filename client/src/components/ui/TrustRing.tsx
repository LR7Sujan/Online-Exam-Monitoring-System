import { useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  type TrustRingSize,
  type TrustRingProps,
  TRUST_RING_SIZES,
} from './TrustRing.types';

export type { TrustRingSize, TrustRingProps };

interface Particle {
  id: number;
  angle: number;
  distance: number;
  color: string;
  size: number;
}

// Normalized SVG Geometry Constants (viewBox 0 0 120 120)
const SVG_CENTER = 60;
const SVG_RADIUS = 50;
const SVG_STROKE = 10;
const CIRCUMFERENCE = 2 * Math.PI * SVG_RADIUS; // ~314.159265

export function TrustRing({
  score,
  minThreshold = 70,
  size = 'md',
  showLabel = true,
  showThresholdMarker = true,
  sublabel,
  className = '',
  'data-testid': testId = 'trust-ring',
}: TrustRingProps) {
  const uniqueId = useId().replace(/:/g, '');
  const pixelSize = typeof size === 'number' ? size : TRUST_RING_SIZES[size] ?? 80;
  const clamped = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));

  // Inner circle dimensions in pixels (clearance inside stroke)
  // ViewBox: 120, stroke is 10, inner diameter is 120 - 2 * 10 = 100
  const innerBoxSize = Math.floor(pixelSize * (100 / 120));

  // Risk tier & color configuration
  // Emerald >= 85, Amber 60 to 84, Rose below 60
  const isDanger = clamped < 60 || clamped < minThreshold;
  const isWarning = !isDanger && clamped < 85;

  let primaryColor = '#10B981'; // Emerald
  let stopColor1 = '#10B981';
  let stopColor2 = '#34D399';

  if (clamped < 60 || clamped < minThreshold) {
    primaryColor = '#F43F5E'; // Rose
    stopColor1 = '#F43F5E';
    stopColor2 = '#FB7185';
  } else if (clamped < 85) {
    primaryColor = '#F59E0B'; // Amber
    stopColor1 = '#F59E0B';
    stopColor2 = '#FBBF24';
  }

  // Glow intensifies as score drops
  const scoreDrop = 100 - clamped;
  const glowRadius = Math.round(3 + scoreDrop * 0.15);
  const glowAlpha = Math.min(0.8, 0.2 + scoreDrop * 0.005);

  // End marker dot: rendered at computed (dotX, dotY) in SVG user-unit space.
  // Math: angle from 12 o'clock (0=top, clockwise), x=60+50*sin, y=60-50*cos
  // At score=0: (60,10) top. At 25: (110,60) right. At 50: (60,110) bottom. At 75: (10,60) left.
  const dotX = Number((SVG_CENTER + SVG_RADIUS * Math.sin((clamped / 100) * 2 * Math.PI)).toFixed(2));
  const dotY = Number((SVG_CENTER - SVG_RADIUS * Math.cos((clamped / 100) * 2 * Math.PI)).toFixed(2));
  // Render dot only when 0 < score < 100 (at 100 full ring with no dot, at 0 track only)
  const showDot = clamped > 0 && clamped < 100;

  // Arc stroke offset (rotates from 12 o'clock clockwise)
  const arcOffset = CIRCUMFERENCE * (1 - clamped / 100);

  // Shared animation spring transition for coupled arc & dot motion
  const springTransition = {
    type: 'spring' as const,
    stiffness: 90,
    damping: 18,
    mass: 0.8,
  };

  // Font sizing relative to ring diameter
  const isXs = pixelSize <= 44;
  const isSm = pixelSize > 44 && pixelSize <= 64;
  const isThreeDigit = clamped === 100;

  // Scale down for 3 digits so 100 always fits comfortably inside inner circle
  const numRatio = isThreeDigit ? 0.21 : 0.26;
  const numFontSize = Math.max(9, Math.round(pixelSize * numRatio));
  const pctFontSize = Math.max(6, Math.round(pixelSize * 0.12));
  const capFontSize = Math.max(7, Math.round(pixelSize * 0.09));

  // Particle burst on score restoration
  const prevScoreRef = useRef(clamped);
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (clamped > prevScoreRef.current + 1) {
      const sparkColors = ['#10B981', '#34D399', '#6366F1', '#8B5CF6', '#FBBF24'];
      const burstCount = 14;
      const newParticles: Particle[] = Array.from({ length: burstCount }, (_, i) => {
        const pAngle = (i / burstCount) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
        const distance = SVG_RADIUS * 0.8 + Math.random() * (SVG_RADIUS * 0.7);
        return {
          id: Date.now() + i,
          angle: pAngle,
          distance,
          color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
          size: Math.random() * 3 + 2,
        };
      });
      setParticles(newParticles);
      const timer = setTimeout(() => setParticles([]), 900);
      return () => clearTimeout(timer);
    }
    prevScoreRef.current = clamped;
  }, [clamped]);

  // Threshold tick coordinates
  const hasThresholdTick =
    showThresholdMarker &&
    typeof minThreshold === 'number' &&
    minThreshold > 0 &&
    minThreshold < 100;
  const tickAngle = ((minThreshold || 70) / 100) * 2 * Math.PI;
  const tickX1 = Number((SVG_CENTER + 44 * Math.sin(tickAngle)).toFixed(2));
  const tickY1 = Number((SVG_CENTER - 44 * Math.cos(tickAngle)).toFixed(2));
  const tickX2 = Number((SVG_CENTER + 56 * Math.sin(tickAngle)).toFixed(2));
  const tickY2 = Number((SVG_CENTER - 56 * Math.cos(tickAngle)).toFixed(2));

  const gradientId = `trust-grad-${uniqueId}`;

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
      data-testid={testId}
      data-score={clamped}
      data-size={pixelSize}
      style={{ width: `${pixelSize}px`, height: `${pixelSize}px` }}
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${className}`}
    >
      {/* Critical intensified pulsing aura when below threshold or critically low */}
      {isDanger && (
        <motion.div
          animate={{
            scale: [1, 1.16, 1],
            opacity: [0.2, 0.55, 0.2],
          }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute inset-0 rounded-full bg-rose-500/20 blur-md pointer-events-none"
        />
      )}

      {/* SVG Container with unified 0 0 120 120 viewBox */}
      <svg
        viewBox="0 0 120 120"
        width={pixelSize}
        height={pixelSize}
        className="w-full h-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={stopColor1} />
            <stop offset="100%" stopColor={stopColor2} />
          </linearGradient>
        </defs>

        {/* Background Track Circle */}
        <circle
          cx={SVG_CENTER}
          cy={SVG_CENTER}
          r={SVG_RADIUS}
          fill="none"
          stroke="currentColor"
          className="text-zinc-200 dark:text-zinc-800/80"
          strokeWidth={SVG_STROKE}
        />

        {/* Optional Min Threshold Radial Tick */}
        {hasThresholdTick && (
          <line
            data-testid="trust-ring-threshold-tick"
            x1={tickX1}
            y1={tickY1}
            x2={tickX2}
            y2={tickY2}
            stroke="#F43F5E"
            strokeWidth={2.4}
            strokeLinecap="round"
            opacity={0.85}
          />
        )}

        {/* Foreground Progress Arc (Starts at 12 o'clock and fills clockwise) */}
        {clamped > 0 && (
          <g transform={`rotate(-90 ${SVG_CENTER} ${SVG_CENTER})`}>
            <motion.circle
              data-testid="trust-ring-arc"
              cx={SVG_CENTER}
              cy={SVG_CENTER}
              r={SVG_RADIUS}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={SVG_STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              initial={false}
              animate={{ strokeDashoffset: arcOffset }}
              transition={springTransition}
              style={{
                filter: `drop-shadow(0 0 ${glowRadius}px ${primaryColor}${Math.round(
                  glowAlpha * 255
                )
                  .toString(16)
                  .padStart(2, '0')})`,
              }}
            />
          </g>
        )}

        {/* End Marker Dot — rendered as a motion.circle that animates cx/cy as SVG
            presentation attributes. We supply both static cx/cy props (so the browser
            can render on the first frame) and animate the same values so Framer Motion
            springs between positions when the score changes. */}
        {showDot && (
          <motion.circle
            data-testid="trust-ring-dot"
            data-cx={dotX}
            data-cy={dotY}
            data-score={clamped}
            cx={dotX}
            cy={dotY}
            r={5}
            fill={primaryColor}
            stroke="#ffffff"
            strokeWidth={1.5}
            animate={{
              cx: dotX,
              cy: dotY,
            }}
            transition={springTransition}
            style={{ filter: `drop-shadow(0 1px 3px rgba(0,0,0,0.4))` }}
          />
        )}
      </svg>

      {/* Center Readout HTML Overlay (absolutely centered inside inner circle) */}
      {showLabel && (
        <div
          data-testid="trust-ring-overlay"
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div
            data-testid="trust-ring-inner"
            style={{
              width: `${innerBoxSize}px`,
              height: `${innerBoxSize}px`,
            }}
            className="flex flex-col items-center justify-center text-center overflow-hidden"
          >
            <div className="flex items-baseline justify-center leading-none">
              <span
                data-testid="trust-ring-value"
                style={{ fontSize: `${numFontSize}px`, lineHeight: 1 }}
                className="font-mono font-bold tracking-tight tabular-nums text-foreground whitespace-nowrap"
              >
                {clamped}
              </span>
              {!isXs && (
                <span
                  data-testid="trust-ring-percent"
                  style={{ fontSize: `${pctFontSize}px`, lineHeight: 1 }}
                  className="font-mono text-muted-foreground ml-0.5 font-medium whitespace-nowrap"
                >
                  %
                </span>
              )}
            </div>

            {sublabel && !isXs && !isSm && (
              <span
                data-testid="trust-ring-sublabel"
                style={{ fontSize: `${capFontSize}px`, lineHeight: 1.1 }}
                className="font-mono uppercase tracking-wider text-muted-foreground mt-1 max-w-full truncate px-0.5"
              >
                {sublabel}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Particle Restoration Burst Animation */}
      <AnimatePresence>
        {particles.map((p) => {
          // Scale particle offset from SVG coordinates to actual pixel size
          const scaleFactor = pixelSize / 120;
          const x = (SVG_CENTER + p.distance * Math.cos(p.angle)) * scaleFactor;
          const y = (SVG_CENTER + p.distance * Math.sin(p.angle)) * scaleFactor;
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
                scale: [0.2, 1.25, 0],
                opacity: [1, 0.85, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                width: p.size * scaleFactor,
                height: p.size * scaleFactor,
                borderRadius: '9999px',
                backgroundColor: p.color,
                boxShadow: `0 0 6px ${p.color}`,
                pointerEvents: 'none',
              }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
