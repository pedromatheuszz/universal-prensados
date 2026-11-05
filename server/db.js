// Acesso ao banco. Em produção usa o Neon (DATABASE_URL); em desenvolvimento e nos
// testes um adaptador local (PGlite) é injetado via setDb().
import { neon } from '@neondatabase/serverless';
import fs from 'fs';

let adapter = null;

export function setDb(db) {
  adapter = db;
}

export function getDb() {
  if (adapter) return adapter;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não configurada');
  const sql = neon(url);
  adapter = { query: (text, params = []) => sql.query(text, params) };
  return adapter;
}

// Divide o schema em comandos individuais (o driver HTTP do Neon executa um por vez)
export function schemaStatements(file = 'db/schema.sql') {
  return fs.readFileSync(file, 'utf8')
    .split('\n').filter(line => !line.trim().startsWith('--')).join('\n')
    .split(';').map(s => s.trim()).filter(Boolean);
}

export async function migrate(db = getDb()) {
  for (const statement of schemaStatements()) await db.query(statement);
}
