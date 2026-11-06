// /api/admin/session
//   POST    faz login e devolve o token do app
//   GET     confere a sessão e devolve um token renovado (o app chama de tempos em tempos,
//           assim o computador da cozinha não é deslogado no meio do expediente)
//   DELETE  logout (o app só descarta o token)
import { getDb } from '../../server/db.js';
import { handle, json, readJson, clientIpHash, methodNotAllowed, HttpError } from '../../server/http.js';
import { verifyPassword, hashPassword, createToken, requireStaff, toPublicUser } from '../../server/auth.js';

const MAX_FAILURES = 10;
const WINDOW_MIN = 15;

// Hash descartável: com usuário inexistente a senha é verificada do mesmo jeito,
// para o tempo de resposta não revelar quais usuários existem
let dummyHash;
const fakeVerify = (password) => verifyPassword(password, dummyHash ||= hashPassword('usuario-inexistente'));

export default handle(async (req, context) => {
  const db = getDb();

  if (req.method === 'GET') {
    const user = await requireStaff(req, db);
    const [row] = await db.query('SELECT session_version FROM staff_users WHERE username = $1', [user.username]);
    return json({ user, token: createToken(user.username, row.session_version) });
  }
  if (req.method === 'DELETE') return json({ ok: true });
  if (req.method !== 'POST') return methodNotAllowed(['GET', 'POST', 'DELETE']);

  const ipHash = clientIpHash(req, context);
  const [{ n }] = await db.query(
    `SELECT count(*)::int AS n FROM login_attempts WHERE ip_hash = $1 AND created_at > now() - ($2::int * interval '1 minute')`,
    [ipHash, WINDOW_MIN]
  );
  if (n >= MAX_FAILURES) throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos.');

  const { username, password } = await readJson(req);
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 200) {
    throw new HttpError(422, 'Informe usuário e senha');
  }
  const [user] = await db.query('SELECT * FROM staff_users WHERE username = $1', [username.trim().toLowerCase()]);
  const valid = user ? verifyPassword(password, user.password_hash) : fakeVerify(password) && false;

  if (!valid) {
    await db.query('INSERT INTO login_attempts (ip_hash) VALUES ($1)', [ipHash]);
    // a tabela só precisa da janela recente
    await db.query("DELETE FROM login_attempts WHERE created_at < now() - interval '1 day'");
    throw new HttpError(401, 'Usuário ou senha incorretos');
  }
  if (!user.active) throw new HttpError(403, 'Usuário desativado. Fale com o dono da loja.');

  await db.query('DELETE FROM login_attempts WHERE ip_hash = $1', [ipHash]);
  return json({ token: createToken(user.username, user.session_version), user: toPublicUser(user) });
});

export const config = { path: '/api/admin/session' };
