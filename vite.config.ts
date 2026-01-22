import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/itinerary-planner/',
  optimizeDeps: {
    include: ['firebase/app', 'firebase/database'],
  },
  server: {
    host: true, // Needed for Docker
    port: 5173,
    watch: {
      usePolling: true // Often needed for Docker volumes
    }
  }
})
