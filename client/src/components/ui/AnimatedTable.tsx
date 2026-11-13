import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (item: T, index: number) => ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  sortable?: boolean;
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
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  stickyHeader?: boolean;
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
  emptyMessage = 'No records located.',
  emptyState,
  className = '',
  sortKey,
  sortDirection,
  onSort,
  stickyHeader = true,
}: AnimatedTableProps<T>) {
  return (
    <div
      className={`overflow-x-auto rounded-[20px] border border-border bg-surface text-foreground shadow-bento ${className}`}
    >
      <table className="w-full text-sm text-left border-collapse">
        <thead
          className={`bg-surface-elevated/95 backdrop-blur-sm text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border select-none ${
            stickyHeader ? 'sticky top-0 z-10' : ''
          }`}
        >
          <tr>
            {columns.map((col) => {
              const isSorted = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && onSort?.(col.key)}
                  className={`px-4 py-3.5 font-semibold ${alignStyles[col.align ?? 'left']} ${
                    col.sortable ? 'cursor-pointer hover:text-foreground transition-colors' : ''
                  } ${col.className ?? ''}`}
                >
                  <div
                    className={`inline-flex items-center gap-1.5 ${
                      col.align === 'right'
                        ? 'justify-end w-full'
                        : col.align === 'center'
                        ? 'justify-center w-full'
                        : ''
                    }`}
                  >
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-muted-foreground">
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-brand" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-brand" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-50 hover:opacity-100" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-sans">
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
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  {emptyState ?? (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {emptyMessage}
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
                      backgroundColor: 'rgba(244, 63, 94, 0.08)',
                      transition: { duration: 0.2 },
                    }}
                    transition={{
                      duration: 0.25,
                      ease: 'easeOut',
                    }}
                    onClick={() => onRowClick?.(item)}
                    className={`transition-colors duration-150 group hover:bg-muted/50 ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3.5 text-foreground ${alignStyles[col.align ?? 'left']} ${
                          col.className ?? ''
                        }`}
                      >
                        {col.render
                          ? col.render(item, idx)
                          : (item as Record<string, unknown>)[col.key] != null
                          ? String((item as Record<string, unknown>)[col.key])
                          : '—'}
                      </td>
                    ))}
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

export const DataTable = AnimatedTable;
