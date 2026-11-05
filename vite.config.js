import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Code splitting strategy
        manualChunks: {
          'vendor-three': ['three'],
          'vendor-utils': [],
        },
        // Asset naming with hashes for cache busting
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(png|jpe?g|gif|svg|webp|avif|woff2?|ttf|eot)$/.test(assetInfo.name)) {
            return `assets/images/[name]-[hash].${ext}`;
          }
          if (/\.css$/.test(assetInfo.name)) {
            return `assets/css/[name]-[hash].${ext}`;
          }
          return `assets/[name]-[hash].${ext}`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    // CSS code splitting
    cssCodeSplit: true,
    // Module preloading
    modulePreload: {
      polyfill: true,
    },
    // Target modern browsers
    target: 'es2022',
    // Report compressed size
    reportCompressedSize: true,
    // Chunk size warning limit
    chunkSizeWarningLimit: 500,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['three'],
    exclude: [],
  },
  // Server configuration for development
  server: {
    port: 3000,
    open: true,
    cors: true,
    headers: {
      'Service-Worker-Allowed': '/',
    },
  },
  // Preview server (for production preview)
  preview: {
    port: 4173,
    open: true,
  },
  // CSS configuration
  css: {
    devSourcemap: true,
    postcss: {
      plugins: [],
    },
  },
  // ESBuild options
  esbuild: {
    target: 'es2022',
    treeShaking: true,
    pure: ['console.log'],
    drop: ['debugger'],
  },
  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});