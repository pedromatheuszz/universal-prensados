import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import { devApi } from '../server/dev-api.js';

// Site dos clientes. Rode pela raiz do repositório (npm run dev / npm run build):
// a API em ../server e ../netlify/functions é servida junto pelo plugin devApi.

// Troca as referências fixas do index.html (ex.: images/optimized/cut_dogzao-320w.webp)
// pelos nomes com hash gerados por scripts/optimize-images.js
function optimizedImagesInHtml() {
  return {
    name: 'optimized-images-html',
    transformIndexHtml(html) {
      const map = JSON.parse(fs.readFileSync(resolve(import.meta.dirname, 'public/images/optimized/image-map.json'), 'utf8'));
      return html.replace(/images\/optimized\/([a-z0-9_]+?)(-\d+w)?\.(webp|avif)/g, (match, name, size = '', ext) =>
        map[name] ? `images/optimized/${map[name].file}${size}.${ext}` : match);
    },
  };
}

export default defineConfig({
  root: import.meta.dirname,
  plugins: [optimizedImagesInHtml(), devApi()],
  publicDir: resolve(import.meta.dirname, 'public'),
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    assetsDir: 'assets',
    // sem .map públicos: o site no ar não precisa expor o código-fonte original
    sourcemap: false,
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
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        pedido: resolve(import.meta.dirname, 'pedido/index.html'),
      },
      output: {
        // GSAP em um arquivo separado (muda pouco, fica no cache do navegador)
        manualChunks: (id) => (id.includes('node_modules/gsap') ? 'vendor-gsap' : undefined),
        // Asset naming with hashes for cache busting
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] || assetInfo.name || '';
          const ext = name.split('.').pop();
          if (/\.(png|jpe?g|gif|svg|webp|avif|woff2?|ttf|eot)$/.test(name)) {
            return `assets/images/[name]-[hash].${ext}`;
          }
          if (/\.css$/.test(name)) {
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
    open: !process.env.NO_OPEN,
    headers: {
      'Service-Worker-Allowed': '/',
    },
  },
  // Preview server (for production preview)
  preview: {
    port: 4173,
    open: !process.env.NO_OPEN,
  },
  // CSS configuration
  css: {
    devSourcemap: true,
    postcss: {
      plugins: [],
    },
  },
  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});