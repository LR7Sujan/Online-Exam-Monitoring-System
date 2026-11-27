import { motion } from 'framer-motion';
import { useMemo } from 'react';

export interface ParticleBurstProps {
  count?: number;
  colors?: string[];
  duration?: number;
  className?: string;
}

const DEFAULT_COLORS = ['#10B981', '#34D399', '#FBBF24', '#38BDF8', '#F43F5E'];

export function ParticleBurst({
  count = 20,
  colors = DEFAULT_COLORS,
  duration = 0.9,
  className = '',
}: ParticleBurstProps) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * 360 + (Math.random() * 20 - 10);
      const rad = (angle * Math.PI) / 180;
      const distance = 40 + Math.random() * 60;
      const size = 4 + Math.random() * 5;
      const color = colors[i % colors.length];

      return {
        id: i,
        x: Math.cos(rad) * distance,
        y: Math.sin(rad) * distance,
        size,
        color,
        rotate: Math.random() * 360,
      };
    });
  }, [count, colors]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible z-50 ${className}`}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{
            x: 0,
            y: 0,
            scale: 0,
            opacity: 1,
            rotate: 0,
          }}
          animate={{
            x: p.x,
            y: p.y,
            scale: [0, 1.2, 0.4, 0],
            opacity: [1, 1, 0.8, 0],
            rotate: p.rotate,
          }}
          transition={{
            duration,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: '9999px',
            backgroundColor: p.color,
            boxShadow: `0 0 8px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}
