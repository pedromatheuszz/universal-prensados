// /api/admin/session
//   POST    faz login e devolve o token do app
//   GET     confere a sessão e devolve um token renovado (o app chama de tempos em tempos,
//           assim o computador da cozinha não é deslogado no meio do expediente)
//   DELETE  logout (o app só descarta o token)
import { getDb } from '../../server/db.js';
import { handle, json, readJson, clientIpHash, methodNotAllowed, HttpError } from '../../server/http.js';
import { verifyPassword, hashPassword, needsRehash, createToken, requireStaff, toPublicUser, audit } from '../../server/auth.js';
import { countEvents, addEvent, clearEvents } from '../../server/rate-limit.js';

const WINDOW_MIN = 15;
const MAX_FAILURES_IP = 10;   // do mesmo computador/rede
const MAX_FAILURES_USER = 20; // contra o mesmo usuário, vindo de qualquer lugar
const TOO_MANY = 'Muitas tentativas. Aguarde 15 minutos.';

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
  if (n >= MAX_FAILURES_IP) throw new HttpError(429, TOO_MANY);

  const { username, password } = await readJson(req);
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || password.length > 200) {
    throw new HttpError(422, 'Informe usuário e senha');
  }
  const name = username.trim().toLowerCase().slice(0, 64);
  // conta para qualquer nome digitado, exista ou não (a resposta não revela quem existe)
  if (await countEvents(db, 'login-user', name, WINDOW_MIN) >= MAX_FAILURES_USER) throw new HttpError(429, TOO_MANY);

  const [user] = await db.query('SELECT * FROM staff_users WHERE username = $1', [name]);
  const valid = user ? verifyPassword(password, user.password_hash) : fakeVerify(password) && false;

  if (!valid) {
    await db.query('INSERT INTO login_attempts (ip_hash) VALUES ($1)', [ipHash]);
    await db.query("DELETE FROM login_attempts WHERE created_at < now() - interval '1 day'");
    await addEvent(db, 'login-user', name);
    throw new HttpError(401, 'Usuário ou senha incorretos');
  }
  if (!user.active) throw new HttpError(403, 'Usuário desativado. Fale com o dono da loja.');

  await db.query('DELETE FROM login_attempts WHERE ip_hash = $1', [ipHash]);
  await clearEvents(db, 'login-user', name);
  // senha guardada no formato antigo/mais fraco: refaz agora que a senha certa foi digitada
  if (needsRehash(user.password_hash)) {
    await db.query('UPDATE staff_users SET password_hash = $2 WHERE username = $1', [user.username, hashPassword(password)]);
  }
  await audit(db, user.username, 'sessao.entrar');
  return json({ token: createToken(user.username, user.session_version), user: toPublicUser(user) });
});

export const config = { path: '/api/admin/session' };
