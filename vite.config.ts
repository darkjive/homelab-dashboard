import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend port — keep in sync with server/index.ts (PORT env var, default 3010)
const backendPort = process.env.PORT || '3010';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API calls to backend server
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
      // Proxy WebSocket connections
      '/ws': {
        target: `ws://localhost:${backendPort}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the heavyweights out of the main chunk for better caching and
        // to stay under Rollup's 500 kB warning.
        manualChunks: {
          react: ['react', 'react-dom'],
          recharts: ['recharts'],
          grid: ['react-grid-layout'],
        },
      },
    },
  },
});
