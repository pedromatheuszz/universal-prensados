// /api/admin/session — POST faz login (devolve o token do app), GET informa o usuário atual
import { getDb } from '../../server/db.js';
import { handle, json, readJson, clientIpHash, methodNotAllowed, HttpError } from '../../server/http.js';
import { verifyPassword, createToken, requireStaff, toPublicUser } from '../../server/auth.js';

const MAX_FAILURES = 10;
const WINDOW_MIN = 15;

export default handle(async (req, context) => {
  const db = getDb();

  if (req.method === 'GET') return json({ user: await requireStaff(req, db) });
  if (req.method === 'DELETE') return json({ ok: true }); // o app só descarta o token
  if (req.method !== 'POST') return methodNotAllowed(['GET', 'POST', 'DELETE']);

  const ipHash = clientIpHash(req, context);
  const [{ n }] = await db.query(
    `SELECT count(*)::int AS n FROM login_attempts WHERE ip_hash = $1 AND created_at > now() - ($2::int * interval '1 minute')`,
    [ipHash, WINDOW_MIN]
  );
  if (n >= MAX_FAILURES) throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos.');

  const { username, password } = await readJson(req);
  const user = typeof username === 'string' && typeof password === 'string'
    ? (await db.query('SELECT * FROM staff_users WHERE username = $1', [username.trim().toLowerCase()]))[0]
    : null;

  if (!user || !verifyPassword(password, user.password_hash)) {
    await db.query('INSERT INTO login_attempts (ip_hash) VALUES ($1)', [ipHash]);
    throw new HttpError(401, 'Usuário ou senha incorretos');
  }
  if (!user.active) throw new HttpError(403, 'Usuário desativado. Fale com o dono da loja.');

  await db.query('DELETE FROM login_attempts WHERE ip_hash = $1', [ipHash]);
  return json({ token: createToken(user.username, user.session_version), user: toPublicUser(user) });
});

export const config = { path: '/api/admin/session' };
