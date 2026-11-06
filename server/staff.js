// Cadastro da equipe pelo app (somente o papel "dono" acessa).
import { HttpError } from './http.js';
import { ROLES, hashPassword } from './auth.js';

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
export const MIN_PASSWORD = 10;

const toStaff = (r) => ({
  username: r.username,
  displayName: r.display_name || r.username,
  role: r.role,
  roleLabel: ROLES[r.role] || r.role,
  active: r.active,
  createdAt: new Date(r.created_at).toISOString(),
});

export async function listStaff(db) {
  const rows = await db.query('SELECT username, display_name, role, active, created_at FROM staff_users ORDER BY active DESC, username');
  return rows.map(toStaff);
}

function checkPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    throw new HttpError(422, `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres`);
  }
}

export async function createStaff(db, body) {
  const username = String(body?.username || '').trim().toLowerCase();
  if (!USERNAME_RE.test(username)) throw new HttpError(422, 'Usuário: 3 a 32 caracteres (letras minúsculas, números, . _ -)');
  if (!ROLES[body?.role]) throw new HttpError(422, 'Escolha um papel válido');
  checkPassword(body?.password);
  const displayName = String(body?.displayName || '').trim().slice(0, 60);
  const [exists] = await db.query('SELECT 1 FROM staff_users WHERE username = $1', [username]);
  if (exists) throw new HttpError(409, 'Já existe um usuário com esse nome');
  await db.query(
    'INSERT INTO staff_users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4)',
    [username, hashPassword(body.password), displayName, body.role]
  );
  return username;
}

/** Atualiza nome, papel, ativo e/ou senha. Impede que a loja fique sem nenhum dono ativo. */
export async function updateStaff(db, username, body, actor) {
  const [current] = await db.query('SELECT * FROM staff_users WHERE username = $1', [username]);
  if (!current) throw new HttpError(404, 'Usuário não encontrado');

  const role = body?.role !== undefined ? body.role : current.role;
  if (!ROLES[role]) throw new HttpError(422, 'Escolha um papel válido');
  const active = typeof body?.active === 'boolean' ? body.active : current.active;
  const displayName = body?.displayName !== undefined ? String(body.displayName).trim().slice(0, 60) : current.display_name;

  if (current.role === 'dono' && current.active && (role !== 'dono' || !active)) {
    const [{ n }] = await db.query("SELECT count(*)::int AS n FROM staff_users WHERE role = 'dono' AND active AND username <> $1", [username]);
    if (n === 0) throw new HttpError(409, 'É preciso ter pelo menos um dono ativo');
  }
  if (username === actor && !active) throw new HttpError(409, 'Você não pode desativar o próprio usuário');

  let passwordHash = current.password_hash;
  let bump = role !== current.role || active !== current.active;
  if (body?.password) {
    checkPassword(body.password);
    passwordHash = hashPassword(body.password);
    bump = true;
  }

  await db.query(
    `UPDATE staff_users SET display_name = $2, role = $3, active = $4, password_hash = $5,
            session_version = session_version + $6 WHERE username = $1`,
    [username, displayName, role, active, passwordHash, bump ? 1 : 0]
  );
}

export async function listAudit(db, limit = 200) {
  const rows = await db.query('SELECT username, action, details, created_at FROM audit_log ORDER BY created_at DESC LIMIT $1', [limit]);
  return rows.map(r => ({ username: r.username, action: r.action, details: r.details, at: new Date(r.created_at).toISOString() }));
}
