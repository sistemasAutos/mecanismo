//--- hex-eyes-engine/vite.config.ts 
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@core': '/src/core',
      '@grid': '/src/grid',
      '@tracking': '/src/tracking',
      '@interaction': '/src/interaction',
      '@render': '/src/render',
      '@state': '/src/state',
      '@data': '/src/data'
    }
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    minify: 'esbuild'
  }
});
