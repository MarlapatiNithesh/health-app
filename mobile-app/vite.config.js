import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/phone': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/medibot': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/wearables': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
});
