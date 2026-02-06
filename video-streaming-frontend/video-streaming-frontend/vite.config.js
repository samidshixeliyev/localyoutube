import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  
  server: {
    port: 3000,
    host: '0.0.0.0',
    
    proxy: {
      '/api': {
        target: 'http://172.22.111.47:8081',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[Proxy Error]', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // FIX: Show target correctly
            console.log('[Proxy] →', req.url, '→ http://172.22.111.47:8081' + req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[Proxy] ←', proxyRes.statusCode, req.url);
          });
        },
      },
      
      '/hls': {
        target: 'http://172.22.111.47:8081',
        changeOrigin: true,
        secure: false,
      },
      
      '/thumbnails': {
        target: 'http://172.22.111.47:8081',
        changeOrigin: true,
        secure: false,
      }
    }
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})