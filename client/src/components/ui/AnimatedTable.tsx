import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (item: T, index: number) => ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
}

export interface AnimatedTableProps<T> {
  columns: Column<T>[];
  data: T[];
  getRowKey: (item: T, index: number) => string | number;
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyState?: ReactNode;
  className?: string;
}

const alignStyles = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function AnimatedTable<T>({
  columns,
  data,
  getRowKey,
  onRowClick,
  isLoading = false,
  emptyMessage = 'No telemetry records located.',
  emptyState,
  className = '',
}: AnimatedTableProps<T>) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-white/10 bg-[#101222]/80 backdrop-blur-md ${className}`}>
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-[#16192E]/90 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-white/10 select-none">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={`px-4 py-3 font-semibold ${alignStyles[col.align ?? 'left']} ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 font-sans">
          <AnimatePresence mode="popLayout" initial={false}>
            {data.length === 0 && !isLoading ? (
              <motion.tr
                key="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-slate-400"
                >
                  {emptyState ?? (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="font-mono text-xs text-slate-400">
                        // {emptyMessage}
                      </span>
                    </div>
                  )}
                </td>
              </motion.tr>
            ) : (
              data.map((item, idx) => {
                const key = getRowKey(item, idx);
                return (
                  <motion.tr
                    key={key}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      scale: 0.98,
                      backgroundColor: 'rgba(244, 63, 94, 0.1)',
                      transition: { duration: 0.2 },
                    }}
                    transition={{
                      duration: 0.25,
                      ease: 'easeOut',
                    }}
                    onClick={() => onRowClick?.(item)}
                    className={`transition-colors duration-150 group hover:bg-white/[0.04] ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                  >
                    {columns.map((col) => {
                      const value = (item as Record<string, unknown>)[col.key];
                      return (
                        <td
                          key={`${String(key)}-${col.key}`}
                          className={`px-4 py-3.5 text-slate-200 align-middle ${
                            alignStyles[col.align ?? 'left']
                          } ${col.className ?? ''}`}
                        >
                          {col.render
                            ? col.render(item, idx)
                            : (value as ReactNode) ?? '—'}
                        </td>
                      );
                    })}
                  </motion.tr>
                );
              })
            )}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
