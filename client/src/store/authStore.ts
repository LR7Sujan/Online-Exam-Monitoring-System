import { create } from 'zustand';
import type { AuthUser } from '../types/domain';
import { mediaSession } from '../proctoring/mediaSession';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const STORAGE_KEY = 'proctoriq_auth_v1';

function loadInitialAuth(): { token: string | null; user: AuthUser | null } {
  try {
    // Check URL query param for automated Lighthouse audits and headless runners
    if (typeof window !== 'undefined' && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      const authParam = params.get('__auth');
      if (authParam) {
        const parsed = JSON.parse(decodeURIComponent(authParam)) as { token?: string; user?: AuthUser };
        if (parsed.token && parsed.user) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          return { token: parsed.token, user: parsed.user };
        }
      }
    }

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
    mediaSession.stopAll();
    localStorage.removeItem(STORAGE_KEY);
    set({ token: null, user: null });
  },
}));

