import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Search,
  UserCheck,
  UserX,
} from 'lucide-react';
import { api } from '../../lib/api';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState, ErrorState } from '../ui/EmptyState';
import type { UserRole } from '../../types/domain';

interface UserRecord {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean | number;
  created_at: string;
}

export function UsersManagerTable() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [successUserId, setSuccessUserId] = useState<number | null>(null);

  const usersQuery = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: () => api.get<UserRecord[]>('/admin/users'),
  });

  const users = usersQuery.data ?? [];

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: (vars: { userId: number; role?: UserRole; isActive?: boolean }) =>
      api.patch<UserRecord>(`/admin/users/${vars.userId}`, {
        role: vars.role,
        isActive: vars.isActive,
      }),
    onSuccess: (_, vars) => {
      setSuccessUserId(vars.userId);
      setTimeout(() => setSuccessUserId(null), 2000);
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
    },
  });

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          {(['ALL', 'STUDENT', 'PROCTOR', 'ADMIN'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`rounded-xl px-3 py-1.5 text-xs font-mono font-medium transition-all cursor-pointer ${
                roleFilter === r
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-surface-elevated text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border'
              }`}
            >
              {r === 'ALL' ? 'All Roles' : `${r}s`}
            </button>
          ))}
          <span className="text-xs font-mono text-muted-foreground pl-2">
            Showing <strong className="text-foreground">{filteredUsers.length}</strong> accounts
          </span>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate or staff by name/email..."
            className="w-full rounded-xl border border-border bg-background pl-10 pr-3.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none font-mono"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-border bg-surface-elevated text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3.5 w-16 text-center">ID</th>
                <th className="p-3.5">Full Name</th>
                <th className="p-3.5">Email</th>
                <th className="p-3.5">Assigned Role</th>
                <th className="p-3.5 text-center">Account State</th>
                <th className="p-3.5">Registered</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usersQuery.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skel-${i}`}>
                    <td className="p-3.5"><Skeleton className="h-4 w-8 mx-auto rounded" /></td>
                    <td className="p-3.5"><Skeleton className="h-4 w-32 rounded" /></td>
                    <td className="p-3.5"><Skeleton className="h-4 w-40 rounded" /></td>
                    <td className="p-3.5"><Skeleton className="h-6 w-24 rounded-lg" /></td>
                    <td className="p-3.5 text-center"><Skeleton className="h-5 w-20 rounded-full mx-auto" /></td>
                    <td className="p-3.5"><Skeleton className="h-4 w-24 rounded" /></td>
                    <td className="p-3.5 text-right"><Skeleton className="h-6 w-16 ml-auto rounded-lg" /></td>
                  </tr>
                ))
              ) : usersQuery.isError ? (
                <tr>
                  <td colSpan={7} className="p-8">
                    <ErrorState
                      title="Failed to Load User Directory"
                      description="Could not query candidate and proctor accounts from database. Please retry."
                      onRetry={() => usersQuery.refetch()}
                    />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8">
                    <EmptyState
                      icon={<UserCheck className="w-8 h-8 text-brand" />}
                      title="No Users Found"
                      description="No user accounts matched the search criteria or selected role filter."
                      action={{
                        label: 'Reset Search & Filter',
                        onClick: () => {
                          setSearchQuery('');
                          setRoleFilter('ALL');
                        },
                      }}
                    />
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isActive = Boolean(u.is_active);
                  const isUpdated = successUserId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3.5 text-center font-bold text-muted-foreground tabular-nums">
                        #{u.id}
                      </td>

                      <td className="p-3.5 font-medium text-foreground">
                        {u.full_name}
                      </td>

                      <td className="p-3.5 text-muted-foreground">
                        {u.email}
                      </td>

                      {/* Role Dropdown */}
                      <td className="p-3.5">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            updateUserMutation.mutate({
                              userId: u.id,
                              role: e.target.value as UserRole,
                            })
                          }
                          className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground font-mono font-medium focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none cursor-pointer"
                        >
                          <option value="STUDENT">STUDENT</option>
                          <option value="PROCTOR">PROCTOR</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>

                      {/* Active Status Badge */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                            isActive
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                          }`}
                        >
                          {isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                          {isActive ? 'ACTIVE' : 'DEACTIVATED'}
                        </span>
                      </td>

                      {/* Registered Date */}
                      <td className="p-3.5 text-muted-foreground text-[11px]">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      {/* Deactivate Toggle Action with Spring Physics */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {isUpdated && (
                            <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-mono font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Saved
                            </span>
                          )}
                          <ToggleSwitch
                            checked={isActive}
                            size="sm"
                            label={isActive ? 'Active' : 'Locked'}
                            onChange={(nextActive) =>
                              updateUserMutation.mutate({
                                userId: u.id,
                                isActive: nextActive,
                              })
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
