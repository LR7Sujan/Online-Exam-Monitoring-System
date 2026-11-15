import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Activity,
  Radio,
  ShieldAlert,
  FileText,
  BarChart3,
  Zap,
  Palette,
  GraduationCap,
  Moon,
  Sun,
  Laptop,
  Volume2,
  VolumeX,
  LogOut,
  Search,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../context/ThemeContext';
import { isAudioMuted, setAudioMuted } from '../../utils/audioAlert';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [audioMuted, setAudioMutedState] = useState<boolean>(isAudioMuted());

  // Listen for Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const runCommand = (action: () => void) => {
    action();
    onClose();
  };

  const handleToggleAudio = () => {
    const next = !audioMuted;
    setAudioMutedState(next);
    setAudioMuted(next);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div role="presentation" className="fixed inset-0 z-70 flex items-start justify-center pt-20 sm:pt-28 px-4">
          {/* Glass blur overlay backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Dialog Container */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command Palette"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            className="relative w-full max-w-xl rounded-2xl border border-border bg-surface dark:bg-[#12131d] text-foreground shadow-2xl overflow-hidden z-10"
          >
            <Command label="Command Palette" className="w-full flex flex-col">
              {/* Search Bar */}
              <div className="flex items-center px-4 border-b border-border">
                <Search className="w-4 h-4 text-muted-foreground shrink-0 mr-3" />
                <Command.Input
                  autoFocus
                  placeholder="Type a command or search destination..."
                  className="w-full py-3.5 text-sm bg-transparent outline-none text-foreground placeholder-muted-foreground font-sans"
                />
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted rounded border border-border">
                  ESC
                </kbd>
              </div>

              {/* Suggestions List */}
              <Command.List className="max-h-80 overflow-y-auto p-2 text-xs space-y-1">
                <Command.Empty className="py-6 text-center text-xs text-muted-foreground font-mono">
                  No matching commands found.
                </Command.Empty>

                <Command.Group
                  heading="Navigation"
                  className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono"
                >
                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/home'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-foreground hover:bg-muted cursor-pointer transition-colors"
                  >
                    <Home className="w-4 h-4 text-brand" />
                    <span>Home</span>
                  </Command.Item>
                  {user?.role === 'ADMIN' && (
                    <Command.Item
                      onSelect={() => runCommand(() => navigate('/admin'))}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-foreground hover:bg-muted cursor-pointer transition-colors"
                    >
                      <Activity className="w-4 h-4 text-brand" />
                      <span>Mission Overview</span>
                    </Command.Item>
                  )}

                  {(user?.role === 'ADMIN' || user?.role === 'PROCTOR') && (
                    <>
                      <Command.Item
                        onSelect={() => runCommand(() => navigate('/proctor'))}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-foreground hover:bg-muted cursor-pointer transition-colors"
                      >
                        <Radio className="w-4 h-4 text-sky-500" />
                        <span>Live Surveillance Monitor</span>
                      </Command.Item>

                      <Command.Item
                        onSelect={() => runCommand(() => navigate('/proctor/audit'))}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-foreground hover:bg-muted cursor-pointer transition-colors"
                      >
                        <ShieldAlert className="w-4 h-4 text-rose-500" />
                        <span>Adjudication Review Queue</span>
                      </Command.Item>
                    </>
                  )}

                  {user?.role === 'STUDENT' && (
                    <Command.Item
                      onSelect={() => runCommand(() => navigate('/student'))}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-foreground hover:bg-muted cursor-pointer transition-colors"
                    >
                      <GraduationCap className="w-4 h-4 text-emerald-500" />
                      <span>Candidate Examination Portal</span>
                    </Command.Item>
                  )}

                  {user?.role === 'ADMIN' && (
                    <>
                      <Command.Item
                        onSelect={() => runCommand(() => navigate('/admin/exams'))}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-foreground hover:bg-muted cursor-pointer transition-colors"
                      >
                        <FileText className="w-4 h-4 text-violet-500" />
                        <span>Exam Catalog & Configuration</span>
                      </Command.Item>
                      <Command.Item
                        onSelect={() => runCommand(() => navigate('/admin/analytics'))}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-foreground hover:bg-muted cursor-pointer transition-colors"
                      >
                        <BarChart3 className="w-4 h-4 text-amber-500" />
                        <span>Executive Analytics & Heatmap</span>
                      </Command.Item>
                      <Command.Item
                        onSelect={() => runCommand(() => navigate('/admin/simulator'))}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-foreground hover:bg-muted cursor-pointer transition-colors"
                      >
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <span>Demo Candidate Simulator</span>
                      </Command.Item>
                    </>
                  )}

                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/styleguide'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-foreground hover:bg-muted cursor-pointer transition-colors"
                  >
                    <Palette className="w-4 h-4 text-fuchsia-500" />
                    <span>Component Styleguide</span>
                  </Command.Item>
                </Command.Group>

                <Command.Group
                  heading="Theme & Appearance"
                  className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono"
                >
                  <Command.Item
                    onSelect={() => runCommand(() => setTheme('light'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-foreground hover:bg-muted cursor-pointer transition-colors"
                  >
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Switch to Light Theme {resolvedTheme === 'light' && '✓'}</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(() => setTheme('dark'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-foreground hover:bg-muted cursor-pointer transition-colors"
                  >
                    <Moon className="w-4 h-4 text-brand" />
                    <span>Switch to Dark Theme {resolvedTheme === 'dark' && '✓'}</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(() => setTheme('system'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-foreground hover:bg-muted cursor-pointer transition-colors"
                  >
                    <Laptop className="w-4 h-4 text-sky-500" />
                    <span>Sync with System Preferences {theme === 'system' && '✓'}</span>
                  </Command.Item>
                </Command.Group>

                <Command.Group
                  heading="Actions & Session"
                  className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono"
                >
                  <Command.Item
                    onSelect={() => runCommand(handleToggleAudio)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-foreground hover:bg-muted cursor-pointer transition-colors"
                  >
                    {audioMuted ? (
                      <Volume2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span>{audioMuted ? 'Enable Sound Alerts' : 'Mute Sound Alerts'}</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => runCommand(handleLogout)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out ({user?.email})</span>
                  </Command.Item>
                </Command.Group>
              </Command.List>

              {/* Command Footer */}
              <div className="flex items-center justify-between px-4 py-2 bg-surface-elevated border-t border-border text-[11px] font-mono text-muted-foreground">
                <span>Navigate with ↑↓ • Select with ↵</span>
                <span>ProctorIQ Command Center</span>
              </div>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
