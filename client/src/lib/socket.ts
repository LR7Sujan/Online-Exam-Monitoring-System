import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

const DEFAULT_SOCKET_URL =
  typeof window !== 'undefined' && window.location.port === '5174'
    ? 'http://localhost:4001'
    : 'http://localhost:4000';

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || DEFAULT_SOCKET_URL;

let socketRef: Socket | null = null;

export function getSocket(token: string | null): Socket | null {
  if (!token) {
    if (socketRef) {
      socketRef.disconnect();
      socketRef = null;
    }
    return null;
  }

  if (socketRef) {
    // If socket exists, update its auth token for any active or pending connections
    socketRef.auth = { token };
    if (!socketRef.connected) {
      socketRef.connect();
    }
    return socketRef;
  }

  socketRef = io(SOCKET_URL, {
    auth: (cb) => {
      // Always supply the latest token from auth store
      const currentToken = useAuthStore.getState().token || token;
      cb({ token: currentToken });
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.5,
    timeout: 10000,
    autoConnect: true,
  });

  return socketRef;
}

export function reconnectSocket(): void {
  if (socketRef) {
    const currentToken = useAuthStore.getState().token;
    if (currentToken) {
      socketRef.auth = { token: currentToken };
    }
    socketRef.disconnect().connect();
  } else {
    const currentToken = useAuthStore.getState().token;
    if (currentToken) {
      getSocket(currentToken);
    }
  }
}

export function disconnectSocket(): void {
  if (socketRef) {
    socketRef.disconnect();
    socketRef = null;
  }
}
