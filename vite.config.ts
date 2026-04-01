import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: process.env.VITE_BASE ?? '/itinerary-planner/',
  optimizeDeps: {
    include: ['firebase/app', 'firebase/database'],
  },
  server: {
    host: true, // Needed for Docker
    port: 5173,
    watch: {
      usePolling: true, // Often needed for Docker volumes
    },
  },
});
