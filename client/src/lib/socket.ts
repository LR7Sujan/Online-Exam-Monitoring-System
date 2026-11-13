import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;

let socketRef: Socket | null = null;
let lastToken: string | null = null;

export function getSocket(token: string | null): Socket | null {
  if (!token) {
    if (socketRef) {
      socketRef.disconnect();
      socketRef = null;
      lastToken = null;
    }
    return null;
  }

  if (socketRef && lastToken === token) {
    return socketRef;
  }

  if (socketRef) {
    socketRef.disconnect();
  }

  lastToken = token;
  socketRef = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  return socketRef;
}

export function disconnectSocket(): void {
  if (socketRef) {
    socketRef.disconnect();
    socketRef = null;
    lastToken = null;
  }
}

