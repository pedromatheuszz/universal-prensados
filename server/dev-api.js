/**
 * Plugin do Vite que executa as Netlify Functions dentro do `npm run dev`.
 * - Com DATABASE_URL (no .env.local) usa o Neon de verdade.
 * - Sem DATABASE_URL usa um Postgres local (PGlite em .data/dev-db) com o schema
 *   aplicado e um usuário da equipe de teste (DEV_STAFF_USER / DEV_STAFF_PASSWORD).
 * Em produção quem roteia /api/* é o próprio Netlify (config.path de cada função).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { loadEnv } from 'vite';

const FUNCTIONS_DIR = 'netlify/functions';

function toRegex(pattern) {
  const keys = [];
  const source = pattern.replace(/\/:([A-Za-z_]+)/g, (_, key) => { keys.push(key); return '/([^/]+)'; });
  return { regex: new RegExp(`^${source}/?$`), keys };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export function devApi() {
  let localDb = null;

  return {
    name: 'universal-dev-api',
    apply: 'serve',
    async configureServer(server) {
      Object.assign(process.env, { ...loadEnv('development', process.cwd(), ''), ...process.env });
      process.env.NODE_ENV = 'development';
      // segredo de sessão local persistido, para o login sobreviver a reinícios do servidor
      if (!process.env.SESSION_SECRET) {
        fs.mkdirSync('.data', { recursive: true });
        const file = '.data/dev-session-secret';
        if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'));
        process.env.SESSION_SECRET = fs.readFileSync(file, 'utf8').trim();
      }

      const loadDbModule = () => server.ssrLoadModule('/server/db.js');

      if (!process.env.DATABASE_URL) {
        const { PGlite } = await import('@electric-sql/pglite');
        fs.mkdirSync('.data', { recursive: true });
        const pg = new PGlite('.data/dev-db');
        localDb = { query: (text, params) => pg.query(text, params).then(r => r.rows) };
        // imports nativos: o grafo de módulos do Vite ainda não está pronto neste ponto
        const { migrate } = await import('./db.js');
        await migrate(localDb);

        const user = (process.env.DEV_STAFF_USER || 'equipe').toLowerCase();
        const password = process.env.DEV_STAFF_PASSWORD || 'equipe-dev-123';
        const { hashPassword } = await import('./auth.js');
        await localDb.query(
          `INSERT INTO staff_users (username, password_hash) VALUES ($1, $2)
           ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
          [user, hashPassword(password)]
        );
        server.config.logger.info(`\n  [api] banco local (PGlite) em .data/dev-db — usuário da equipe: "${user}" (senha no .env.example)\n`);
      } else {
        server.config.logger.info('\n  [api] usando o banco Neon de DATABASE_URL\n');
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();
        try {
          // Recarrega as funções a cada requisição para refletir edições sem reiniciar
          const db = await loadDbModule();
          if (localDb) db.setDb(localDb);

          const url = new URL(req.url, 'http://localhost');
          for (const file of fs.readdirSync(FUNCTIONS_DIR).filter(f => f.endsWith('.js'))) {
            const mod = await server.ssrLoadModule('/' + path.posix.join(FUNCTIONS_DIR, file));
            const patterns = [mod.config?.path].flat().filter(Boolean);
            for (const pattern of patterns) {
              const { regex, keys } = toRegex(pattern);
              const match = url.pathname.match(regex);
              if (!match) continue;

              const params = Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
              const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
              const request = new Request(url, { method: req.method, headers: req.headers, body });
              const response = await mod.default(request, { params, ip: req.socket.remoteAddress });

              res.statusCode = response.status;
              response.headers.forEach((value, key) => res.setHeader(key, value));
              res.end(Buffer.from(await response.arrayBuffer()));
              return;
            }
          }
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Rota não encontrada' }));
        } catch (error) {
          server.config.logger.error(`[api] ${error.stack || error}`);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Erro interno' }));
        }
      });
    },
  };
}
