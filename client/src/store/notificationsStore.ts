import { create } from 'zustand';
import { api } from '../lib/api';

export type NotificationType = 'VIOLATION' | 'WARNING' | 'TERMINATION' | 'EXTENSION' | 'INFO';
export type NotificationSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface AppNotification {
  id: number | string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  sessionId?: number;
  studentName?: string;
  examTitle?: string;
  isSessionLive?: boolean;
  createdAt: string;
  readAt?: string | null;
  payload?: Record<string, unknown>;
}

interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
  total: number;
  page: number;
  limit: number;
}

interface NotificationsState {
  items: AppNotification[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchNotifications: () => Promise<void>;
  appendNotification: (item: AppNotification) => void;
  markAsRead: (id: number | string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  updateSessionStatus: (sessionId: number, isLive: boolean) => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<NotificationsResponse>('/notifications?limit=50');
      const loaded = res?.notifications ?? [];
      set({ items: loaded, isLoading: false, error: null });
    } catch (err) {
      console.warn('[NotificationsStore] Failed to fetch notifications:', err);
      set({ isLoading: false, error: 'Failed to load notifications' });
    }
  },

  appendNotification: (item: AppNotification) => {
    set((state) => {
      // Deduplicate by id if present
      if (item.id && state.items.some((i) => i.id === item.id)) {
        return state;
      }
      return {
        items: [
          {
            ...item,
            isSessionLive: item.isSessionLive ?? true,
          },
          ...state.items,
        ],
      };
    });
  },

  markAsRead: async (id: number | string) => {
    const now = new Date().toISOString();
    // Optimistic update
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, readAt: now } : i)),
    }));

    try {
      await api.post(`/notifications/${id}/read`);
    } catch (err) {
      console.warn('[NotificationsStore] Failed to persist read status for notification:', id, err);
    }
  },

  markAllAsRead: async () => {
    const now = new Date().toISOString();
    // Optimistic update
    set((state) => ({
      items: state.items.map((i) => ({ ...i, readAt: i.readAt || now })),
    }));

    try {
      await api.post('/notifications/read-all');
    } catch (err) {
      console.warn('[NotificationsStore] Failed to persist mark-all-read:', err);
    }
  },

  clearAll: async () => {
    // Optimistic update
    set({ items: [] });

    try {
      await api.delete('/notifications');
    } catch (err) {
      console.warn('[NotificationsStore] Failed to persist clear all notifications:', err);
    }
  },

  updateSessionStatus: (sessionId: number, isLive: boolean) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.sessionId === sessionId ? { ...i, isSessionLive: isLive } : i
      ),
    }));
  },
}));

// Derived selectors — SINGLE SOURCE OF TRUTH
export const selectUnreadCount = (state: NotificationsState): number =>
  state.items.filter((i) => !i.readAt).length;

export const selectLiveViolationCount = (state: NotificationsState): number =>
  state.items.filter((i) => !i.readAt && i.type === 'VIOLATION' && i.isSessionLive).length;
