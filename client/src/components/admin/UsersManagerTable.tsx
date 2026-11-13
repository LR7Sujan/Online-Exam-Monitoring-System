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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-2 flex-wrap">
          {(['ALL', 'STUDENT', 'PROCTOR', 'ADMIN'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`rounded-xl px-3 py-1.5 text-xs font-mono font-bold transition-all ${
                roleFilter === r
                  ? 'bg-cyan text-void shadow-glow-cyan-sm'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {r === 'ALL' ? 'All Roles' : `${r}s`}
            </button>
          ))}
          <span className="text-xs font-mono text-slate-400 pl-2">
            Showing <strong className="text-white">{filteredUsers.length}</strong> accounts
          </span>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate or staff by name/email..."
            className="w-full rounded-xl border border-white/10 bg-[#070914] pl-10 pr-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan focus:outline-none font-mono"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0C0E1C]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-white/10 bg-[#121528] text-[11px] uppercase tracking-wider text-slate-400">
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
            <tbody className="divide-y divide-white/5">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No users found matching query.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isActive = Boolean(u.is_active);
                  const isUpdated = successUserId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3.5 text-center font-bold text-slate-400">
                        #{u.id}
                      </td>

                      <td className="p-3.5 font-bold text-white">
                        {u.full_name}
                      </td>

                      <td className="p-3.5 text-slate-300">
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
                          className="rounded-lg border border-white/10 bg-[#070914] px-2.5 py-1 text-xs text-white font-mono font-semibold focus:border-cyan focus:outline-none"
                        >
                          <option value="STUDENT">STUDENT</option>
                          <option value="PROCTOR">PROCTOR</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>

                      {/* Active Status Badge */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isActive
                              ? 'bg-emerald/15 text-emerald border border-emerald/30'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                          {isActive ? 'ACTIVE' : 'DEACTIVATED'}
                        </span>
                      </td>

                      {/* Registered Date */}
                      <td className="p-3.5 text-slate-400 text-[11px]">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      {/* Deactivate Toggle Action with Spring Physics */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {isUpdated && (
                            <span className="text-[10px] text-emerald flex items-center gap-1 font-mono">
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
