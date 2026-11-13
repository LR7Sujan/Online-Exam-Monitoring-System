import { useContext } from 'react';
import { SocketContext } from './SocketContextCore';

export function useSocketContext() {
  return useContext(SocketContext);
}

