import { motion } from 'framer-motion';
import { Compass, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NeonButton } from '../components/ui/NeonButton';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden">
      {/* Background glow orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full p-8 rounded-3xl border border-border bg-surface/80 backdrop-blur-xl shadow-layered-md space-y-6 relative z-10"
      >
        <div className="w-16 h-16 mx-auto rounded-2xl border border-border bg-surface-elevated flex items-center justify-center text-brand shadow-sm">
          <Compass className="w-8 h-8 animate-spin-slow" />
        </div>

        <div className="space-y-2">
          <span className="font-mono text-xs font-semibold text-brand uppercase tracking-widest">
            HTTP 404 Error
          </span>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Sector Not Found
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The requested mission-control coordinates do not exist, were decommissioned, or have been relocated.
          </p>
        </div>

        <div className="pt-2">
          <NeonButton
            variant="primary"
            size="md"
            leftIcon={<Home className="w-4 h-4" />}
            onClick={() => navigate('/')}
            className="w-full justify-center"
          >
            Return to Mission Control
          </NeonButton>
        </div>
      </motion.div>
    </div>
  );
}

export default NotFoundPage;

