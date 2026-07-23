import { defineConfig } from 'vite';

const daemonTarget = process.env.JINI_PLAYGROUND_DAEMON_URL ?? 'http://127.0.0.1:4317';

export default defineConfig({
  server: {
    strictPort: true,
    proxy: {
      '/api': {
        target: daemonTarget,
        changeOrigin: true,
      },
      '/health': {
        target: daemonTarget,
        changeOrigin: true,
      },
      '/ready': {
        target: daemonTarget,
        changeOrigin: true,
      },
    },
  },
});
