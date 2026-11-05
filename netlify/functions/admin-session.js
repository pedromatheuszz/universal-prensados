// /api/admin/session — POST faz login, GET informa a sessão atual, DELETE faz logout
import { getDb } from '../../server/db.js';
import { handle, json, readJson, clientIpHash, methodNotAllowed, HttpError } from '../../server/http.js';
import { verifyPassword, createSessionCookie, clearSessionCookie, readSession } from '../../server/auth.js';

const MAX_FAILURES = 10;
const WINDOW_MIN = 15;

export default handle(async (req, context) => {
  if (req.method === 'GET') {
    const session = readSession(req);
    return session ? json({ username: session.username }) : json({ error: 'Não autenticado' }, 401);
  }

  if (req.method === 'DELETE') {
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
  }

  if (req.method !== 'POST') return methodNotAllowed(['GET', 'POST', 'DELETE']);

  const db = getDb();
  const ipHash = clientIpHash(req, context);
  const [{ n }] = await db.query(
    `SELECT count(*)::int AS n FROM login_attempts WHERE ip_hash = $1 AND created_at > now() - ($2::int * interval '1 minute')`,
    [ipHash, WINDOW_MIN]
  );
  if (n >= MAX_FAILURES) throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos.');

  const { username, password } = await readJson(req);
  const user = typeof username === 'string' && typeof password === 'string'
    ? (await db.query('SELECT username, password_hash FROM staff_users WHERE username = $1', [username.trim().toLowerCase()]))[0]
    : null;

  if (!user || !verifyPassword(password, user.password_hash)) {
    await db.query('INSERT INTO login_attempts (ip_hash) VALUES ($1)', [ipHash]);
    throw new HttpError(401, 'Usuário ou senha incorretos');
  }

  await db.query('DELETE FROM login_attempts WHERE ip_hash = $1', [ipHash]);
  return json({ username: user.username }, 200, { 'Set-Cookie': createSessionCookie(user.username) });
});

export const config = { path: '/api/admin/session' };
