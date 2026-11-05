/**
 * Cria ou redefine a senha de um usuário da equipe no banco Neon.
 * Uso: npm run staff:add -- nome-do-usuario
 * A senha é pedida no terminal (mínimo 10 caracteres) e guardada só como hash scrypt.
 */
import readline from 'readline';
import { loadEnv } from 'vite';
import { getDb } from '../server/db.js';
import { hashPassword } from '../server/auth.js';

Object.assign(process.env, { ...loadEnv('production', process.cwd(), ''), ...process.env });

const username = (process.argv[2] || '').trim().toLowerCase();
if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
  console.error('Uso: npm run staff:add -- nome-do-usuario  (3 a 32 caracteres: letras, números, . _ -)');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('✗ Defina DATABASE_URL (no .env.local ou no ambiente).');
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

const password = process.env.STAFF_PASSWORD || await askHidden(`Senha para "${username}": `);
if (password.length < 10) {
  console.error('✗ A senha precisa ter pelo menos 10 caracteres.');
  process.exit(1);
}

await getDb().query(
  `INSERT INTO staff_users (username, password_hash) VALUES ($1, $2)
   ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
  [username, hashPassword(password)]
);
console.log(`✓ Usuário "${username}" pronto para entrar em /painel/`);
