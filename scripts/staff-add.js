/**
 * Cria ou redefine a senha de um usuário da equipe no banco Neon.
 * Uso: npm run staff:add -- nome-do-usuario [dono|atendente|cozinha]
 * Use para criar o primeiro dono; os demais usuários podem ser cadastrados pelo app (Equipe).
 * A senha é pedida no terminal (mínimo 10 caracteres) e guardada só como hash scrypt.
 */
import readline from 'readline';
import { loadEnv } from 'vite';
import { getDb } from '../server/db.js';
import { hashPassword, ROLES } from '../server/auth.js';

Object.assign(process.env, { ...loadEnv('production', process.cwd(), ''), ...process.env });

const username = (process.argv[2] || '').trim().toLowerCase();
const role = (process.argv[3] || 'dono').trim().toLowerCase();
if (!ROLES[role]) {
  console.error('Papel inválido. Use: dono, atendente ou cozinha');
  process.exit(1);
}
if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
  console.error('Uso: npm run staff:add -- nome-do-usuario  (3 a 32 caracteres: letras, números, . _ -)');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('✗ Defina DATABASE_URL (no .env.local ou no ambiente).');
  process.exit(1);
}

// Lê a senha tecla por tecla, mostrando só "*" (funciona no PowerShell, cmd e terminais Unix)
function askHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    if (!stdin.isTTY) {
      // entrada redirecionada: lê a primeira linha sem eco
      const rl = readline.createInterface({ input: stdin });
      rl.once('line', (line) => { rl.close(); stdout.write('\n'); resolve(line); });
      return;
    }
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          return resolve(value);
        }
        if (ch === '\u0003') { // Ctrl+C
          stdout.write('\n');
          process.exit(130);
        }
        if (ch === '\u0008' || ch === '\u007f') { // Backspace
          if (value.length) {
            value = value.slice(0, -1);
            stdout.write('\b \b');
          }
        } else if (ch >= ' ') {
          value += ch;
          stdout.write('*');
        }
      }
    };
    stdin.on('data', onData);
  });
}

let password = process.env.STAFF_PASSWORD;
if (!password) {
  password = await askHidden(`Senha para "${username}": `);
  if (password.length >= 10 && (await askHidden('Repita a senha: ')) !== password) {
    console.error('✗ As senhas não conferem.');
    process.exit(1);
  }
}
if (password.length < 10) {
  console.error('✗ A senha precisa ter pelo menos 10 caracteres.');
  process.exit(1);
}

await getDb().query(
  `INSERT INTO staff_users (username, password_hash, role) VALUES ($1, $2, $3)
   ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
     active = true, session_version = staff_users.session_version + 1`,
  [username, hashPassword(password), role]
);
console.log(`✓ Usuário "${username}" (${ROLES[role]}) pronto para entrar no app de gestão`);
