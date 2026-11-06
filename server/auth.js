// Autenticação da equipe (app de gestão): senha com scrypt + token assinado (HMAC) enviado
// no cabeçalho Authorization: Bearer. Cada requisição confere no banco se o usuário continua
// ativo, com o mesmo papel e a mesma versão de sessão (trocar senha ou desativar derruba o acesso).
import crypto from 'crypto';
import { HttpError } from './http.js';

const SESSION_HOURS = 14;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export const ROLES = {
  dono: 'Dono',
  atendente: 'Atendente',
  cozinha: 'Cozinha',
};

// Permissão → papéis que a têm
const PERMISSIONS = {
  'orders.view': ['dono', 'atendente', 'cozinha'],
  'orders.status': ['dono', 'atendente', 'cozinha'],
  'orders.cancel': ['dono', 'atendente'],
  'orders.history': ['dono', 'atendente'],
  'stock.toggle': ['dono', 'atendente', 'cozinha'],
  'store.pause': ['dono', 'atendente'],
  'catalog.edit': ['dono'],
  'store.edit': ['dono'],
  'cash.operate': ['dono', 'atendente'],
  'finance.view': ['dono'],
  'staff.manage': ['dono'],
};

export const permissionsFor = (role) => Object.keys(PERMISSIONS).filter(p => PERMISSIONS[p].includes(role));
export const can = (role, permission) => PERMISSIONS[permission]?.includes(role) ?? false;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET ausente ou com menos de 32 caracteres');
  return s;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64url'), expected.length, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return crypto.timingSafeEqual(actual, expected);
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createToken(username, sessionVersion, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ u: username, v: sessionVersion, exp: now + SESSION_HOURS * 3600 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Lê e confere a assinatura do token. Não consulta o banco. */
export function readToken(req, now = Date.now()) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > now ? { username: data.u, version: data.v } : null;
  } catch {
    return null;
  }
}

export const toPublicUser = (row) => ({
  username: row.username,
  displayName: row.display_name || row.username,
  role: row.role,
  roleLabel: ROLES[row.role] || row.role,
  permissions: permissionsFor(row.role),
});

/**
 * Exige login válido e, se informada, a permissão. Retorna o usuário.
 * 401 → precisa entrar de novo; 403 → logado, mas sem permissão.
 */
export async function requireStaff(req, db, permission) {
  const token = readToken(req);
  if (!token) throw new HttpError(401, 'Faça login para continuar');
  const [row] = await db.query('SELECT username, display_name, role, active, session_version FROM staff_users WHERE username = $1', [token.username]);
  if (!row || !row.active || row.session_version !== token.version) throw new HttpError(401, 'Sua sessão expirou. Entre novamente.');
  if (permission && !can(row.role, permission)) throw new HttpError(403, 'Seu usuário não tem permissão para isso');
  return toPublicUser(row);
}

export async function audit(db, username, action, details = null) {
  await db.query('INSERT INTO audit_log (username, action, details) VALUES ($1, $2, $3)', [username, action, details ? JSON.stringify(details) : null]);
}
