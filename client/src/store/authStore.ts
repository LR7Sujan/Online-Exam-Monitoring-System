import { create } from 'zustand';
import type { AuthUser } from '../types/domain';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const STORAGE_KEY = 'proctoriq_auth_v1';

function loadInitialAuth(): { token: string | null; user: AuthUser | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    const parsed = JSON.parse(raw) as { token?: string; user?: AuthUser };
    if (parsed.token && parsed.user) {
      return { token: parsed.token, user: parsed.user };
    }
  } catch {
    // Ignore corrupted storage
  }
  return { token: null, user: null };
}

const initial = loadInitialAuth();

export const useAuthStore = create<AuthState>((set) => ({
  token: initial.token,
  user: initial.user,
  setAuth: (token, user) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ token: null, user: null });
  },
}));

