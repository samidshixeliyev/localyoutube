import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Backend host/port the dev server proxies /api, /hls, /thumbnails,
  // /uploads and /ws to. Override via VITE_BACKEND_URL (e.g. when the
  // backend runs in WSL/Docker on a different host or port).
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:4000';
  const devPort = Number(env.VITE_PORT) || 3000;

  const proxyEntry = (extra = {}) => ({
    target: backendUrl,
    changeOrigin: true,
    secure: false,
    ...extra,
  });

  return {
    plugins: [react()],

    server: {
      port: devPort,
      host: '0.0.0.0',

      proxy: {
        '/api': proxyEntry(),
        '/hls': proxyEntry(),
        '/thumbnails': proxyEntry(),
        '/uploads': proxyEntry(),
        '/ws': proxyEntry({ ws: true }),
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
})
