import { useState } from 'react';
import { SectionDocPage } from '../SectionDocPage';
import { ComponentPreview } from '../ComponentPreview';
import {
  AnimatedTable,
  Column,
  NeonButton,
  StatusPill,
  useToast,
} from '../../../components/ui';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';

interface SampleRow {
  id: number;
  candidate: string;
  exam: string;
  trustScore: number;
  status: string;
  violations: number;
}

const INITIAL_ROWS: SampleRow[] = [
  { id: 101, candidate: 'Aarav Mehta', exam: 'CS-401 Algorithms', trustScore: 92, status: 'IN_PROGRESS', violations: 1 },
  { id: 102, candidate: 'Devanshi Sharma', exam: 'CS-302 Operating Systems', trustScore: 45, status: 'TERMINATED_CHEATING', violations: 4 },
  { id: 103, candidate: 'Rohan Gupta', exam: 'CS-401 Algorithms', trustScore: 100, status: 'SUBMITTED', violations: 0 },
  { id: 104, candidate: 'Priya Iyer', exam: 'EE-205 Signal Processing', trustScore: 78, status: 'IN_PROGRESS', violations: 2 },
];

export function TablesSection() {
  const toast = useToast();
  const [tableData, setTableData] = useState<SampleRow[]>(INITIAL_ROWS);
  const [nextId, setNextId] = useState(105);
  const [sortKey, setSortKey] = useState<string>('trustScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleAddRow = () => {
    const candidates = ['Karan Verma', 'Ananya Roy', 'Vikram Patel', 'Sneha Nair', 'Aditya Joshi'];
    const exams = ['CS-401 Algorithms', 'CS-302 Operating Systems', 'DB-201 MySQL Architecture'];
    const randomScore = Math.floor(Math.random() * 65) + 35;
    const randomStatus = randomScore < 50 ? 'TERMINATED_CHEATING' : randomScore > 90 ? 'SUBMITTED' : 'IN_PROGRESS';

    const newRow: SampleRow = {
      id: nextId,
      candidate: candidates[Math.floor(Math.random() * candidates.length)],
      exam: exams[Math.floor(Math.random() * exams.length)],
      trustScore: randomScore,
      status: randomStatus,
      violations: Math.floor(Math.random() * 5),
    };

    setNextId((c) => c + 1);
    setTableData((prev) => [newRow, ...prev]);
    toast.success('Row Added', `Telemetry record #${newRow.id} generated`);
  };

  const handleRemoveRow = (id: number) => {
    setTableData((prev) => prev.filter((r) => r.id !== id));
    toast.info('Row Removed', `Telemetry row #${id} exited table`);
  };

  const handleResetRows = () => {
    setTableData(INITIAL_ROWS);
    toast.info('Table Reset', 'Sample dataset restored to initial state');
  };

  const tableColumns: Column<SampleRow>[] = [
    {
      key: 'id',
      header: 'Session',
      sortable: true,
      render: (r) => <span className="font-mono text-brand">#{r.id}</span>,
      width: '100px',
    },
    {
      key: 'candidate',
      header: 'Candidate Name',
      sortable: true,
      render: (r) => <span className="font-semibold text-foreground">{r.candidate}</span>,
    },
    {
      key: 'exam',
      header: 'Exam Title',
      render: (r) => <span className="text-muted-foreground text-xs">{r.exam}</span>,
    },
    {
      key: 'trustScore',
      header: 'Trust Score',
      align: 'center',
      sortable: true,
      render: (r) => (
        <span
          className={`font-mono font-bold ${
            r.trustScore >= 80
              ? 'text-emerald-500'
              : r.trustScore >= 60
              ? 'text-amber-500'
              : 'text-rose-500'
          }`}
        >
          {r.trustScore}%
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusPill status={r.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveRow(r.id);
          }}
          className="p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
          title="Remove row"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const toc = [
    { id: 'animated-table', label: 'Sortable AnimatedTable' },
    { id: 'table-mutations', label: 'Interactive Dynamic Mutations' },
  ];

  return (
    <SectionDocPage slug="tables" toc={toc}>
      <ComponentPreview
        id="animated-table"
        title="AnimatedTable (Sortable, Sticky Header)"
        description="Framer motion powered row transitions with column sorting, sticky headers, and custom column rendering."
        badge="AnimatedTable"
        code={`import { AnimatedTable, Column } from '@/components/ui';

<AnimatedTable
  columns={columns}
  data={tableData}
  getRowKey={(r) => r.id}
  sortKey={sortKey}
  sortDirection={sortDirection}
  onSort={handleSort}
  stickyHeader
/>`}
      >
        <div className="space-y-4 w-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground">
              Total Live Records: <strong className="text-foreground">{tableData.length}</strong>
            </span>
            <div className="flex items-center gap-2">
              <NeonButton
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={handleAddRow}
              >
                Add Row
              </NeonButton>
              <NeonButton
                variant="secondary"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={handleResetRows}
              >
                Reset
              </NeonButton>
            </div>
          </div>

          <AnimatedTable
            columns={tableColumns}
            data={tableData}
            getRowKey={(r) => r.id}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            stickyHeader
          />
        </div>
      </ComponentPreview>
    </SectionDocPage>
  );
}
