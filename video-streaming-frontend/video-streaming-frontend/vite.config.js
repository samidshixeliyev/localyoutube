import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    // Your preferred port + accessible from network
    port: 3000,
    host: '0.0.0.0',

    proxy: {
      // HLS streaming (video segments & playlists)
      '/hls': {
        target: 'http://172.22.111.47:8081',
        changeOrigin: true,
        secure: false,
      },

      // Thumbnails / preview images
      '/thumbnails': {
        target: 'http://172.22.111.47:8081',
        changeOrigin: true,
        secure: false,
      },

      // User uploads, avatars, etc.
      '/uploads': {
        target: 'http://172.22.111.47:8081',
        changeOrigin: true,
        secure: false,
      },

      // Optional: if you ever want to proxy API calls too (uncomment if needed)
      // '/api': {
      //   target: 'http://172.22.111.47:8081',
      //   changeOrigin: true,
      //   secure: false,
      //   // rewrite: (path) => path.replace(/^\/api/, '')   // only if backend paths don't start with /api
      // },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,           // smaller production builds
  },
})