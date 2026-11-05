/**
 * Cria/atualiza as tabelas no banco Neon (DATABASE_URL do ambiente ou do .env.local).
 * Uso: npm run db:migrate
 */
import { loadEnv } from 'vite';
import { migrate, schemaStatements } from '../server/db.js';

Object.assign(process.env, { ...loadEnv('production', process.cwd(), ''), ...process.env });
if (!process.env.DATABASE_URL) {
  console.error('✗ Defina DATABASE_URL (no .env.local ou no ambiente) antes de rodar a migração.');
  process.exit(1);
}

await migrate();
console.log(`✓ Schema aplicado (${schemaStatements().length} comandos)`);
