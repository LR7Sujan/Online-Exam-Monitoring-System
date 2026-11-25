import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), '');
    var port = Number(env.VITE_PORT || process.env.PORT || (mode === 'test' ? 5174 : 5173));
    var isTest = mode === 'test' || port === 5174;
    var backendTarget = isTest
        ? (env.VITE_BACKEND_ORIGIN || 'http://localhost:4001')
        : (env.VITE_BACKEND_ORIGIN || process.env.BACKEND_ORIGIN || 'http://localhost:4000');
    return {
        plugins: [react()],
        server: {
            port: port,
            proxy: {
                '/api': {
                    target: backendTarget,
                    changeOrigin: true,
                },
                '/uploads': {
                    target: backendTarget,
                    changeOrigin: true,
                },
                '/socket.io': {
                    target: backendTarget,
                    ws: true,
                },
            },
        },
        preview: {
            port: port,
            proxy: {
                '/api': {
                    target: backendTarget,
                    changeOrigin: true,
                },
                '/uploads': {
                    target: backendTarget,
                    changeOrigin: true,
                },
                '/socket.io': {
                    target: backendTarget,
                    ws: true,
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
                        'vendor-utils': ['@tanstack/react-query', 'zustand', 'axios', 'socket.io-client', 'lucide-react'],
                    },
                },
            },
        },
    };
});
