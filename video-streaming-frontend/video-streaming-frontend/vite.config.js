import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://172.22.111.47:8081',
        changeOrigin: true,
      },
      '/hls': {
        target: 'http://172.22.111.47:8081',
        changeOrigin: true,
      },
      '/thumbnails': {
        target: 'http://172.22.111.47:8081',
        changeOrigin: true,
      }
    }
  }
})
