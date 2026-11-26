import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

declare const process: {
  cwd: () => string;
  env: Record<string, string | undefined>;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_PORT || process.env.PORT || (mode === 'test' ? 5174 : 5173));
  const isTest = mode === 'test' || port === 5174;
  const backendTarget = isTest
    ? (env.VITE_BACKEND_ORIGIN || 'http://localhost:4001')
    : (env.VITE_BACKEND_ORIGIN || process.env.BACKEND_ORIGIN || 'http://localhost:4000');

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-charts': ['recharts'],
            'vendor-motion': ['framer-motion'],
            'vendor-utils': ['@tanstack/react-query', 'zustand', 'axios', 'pusher-js', 'lucide-react'],
          },
        },
      },
    },
  };
});
