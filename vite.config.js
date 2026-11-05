import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// Troca as referências fixas do index.html (ex.: images/optimized/cut_dogzao-320w.webp)
// pelos nomes com hash gerados por scripts/optimize-images.js
function optimizedImagesInHtml() {
  return {
    name: 'optimized-images-html',
    transformIndexHtml(html) {
      const map = JSON.parse(fs.readFileSync('public/images/optimized/image-map.json', 'utf8'));
      return html.replace(/images\/optimized\/([a-z0-9_]+?)(-\d+w)?\.(webp|avif)/g, (match, name, size = '', ext) =>
        map[name] ? `images/optimized/${map[name].file}${size}.${ext}` : match);
    },
  };
}

export default defineConfig({
  root: '.',
  plugins: [optimizedImagesInHtml()],
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
          'vendor-gsap': ['gsap', 'gsap/ScrollTrigger', 'gsap/SplitText'],
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
    include: ['gsap'],
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