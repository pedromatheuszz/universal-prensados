// Autenticação da equipe (app de gestão): senha com scrypt + token assinado (HMAC) enviado
// no cabeçalho Authorization: Bearer. Cada requisição confere no banco se o usuário continua
// ativo, com o mesmo papel e a mesma versão de sessão (trocar senha ou desativar derruba o acesso).
import crypto from 'crypto';
import { HttpError } from './http.js';

const SESSION_HOURS = 14;
// scrypt com custo N = 2^17 (recomendação atual da OWASP). O formato guarda os parâmetros,
// e senhas antigas (N = 2^14, formato curto) são refeitas no próximo login certo.
// SCRYPT_N só existe para os testes rodarem rápido; nunca abaixo de 2^14.
const SCRYPT_N = Math.max(16384, Number(process.env.SCRYPT_N) || 2 ** 17);
const SCRYPT = { N: SCRYPT_N, r: 8, p: 1, keylen: 64 };
const LEGACY = { N: 16384, r: 8, p: 1 };
const scryptOpts = ({ N, r, p }) => ({ N, r, p, maxmem: 256 * N * r + 1024 * 1024 });

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
  const hash = crypto.scryptSync(String(password), salt, SCRYPT.keylen, scryptOpts(SCRYPT));
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

// "scrypt$N$r$p$sal$hash" (atual) ou "scrypt$sal$hash" (antigo, N = 2^14)
function parseHash(stored) {
  const parts = String(stored).split('$');
  if (parts[0] !== 'scrypt') return null;
  if (parts.length === 3) return { ...LEGACY, legacy: true, salt: parts[1], hash: parts[2] };
  if (parts.length !== 6) return null;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  // limites para um valor estranho no banco não travar o servidor
  const powerOfTwo = Number.isInteger(Math.log2(N));
  if (!powerOfTwo || N < 16384 || N > 2 ** 20 || !(r >= 1 && r <= 16) || !(p >= 1 && p <= 4)) return null;
  return { N, r, p, salt: parts[4], hash: parts[5] };
}

export function verifyPassword(password, stored) {
  const parsed = parseHash(stored);
  if (!parsed?.salt || !parsed.hash) return false;
  const expected = Buffer.from(parsed.hash, 'base64url');
  const actual = crypto.scryptSync(String(password), Buffer.from(parsed.salt, 'base64url'), expected.length, scryptOpts(parsed));
  return crypto.timingSafeEqual(actual, expected);
}

/** A senha foi guardada com parâmetros mais fracos que os atuais? (refazer no próximo login) */
export function needsRehash(stored) {
  const parsed = parseHash(stored);
  return !parsed || parsed.legacy || parsed.N < SCRYPT.N || parsed.r !== SCRYPT.r || parsed.p !== SCRYPT.p;
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

/** Confere uma permissão de quem já passou por requireStaff (sem nova consulta ao banco). */
export function requirePermission(user, permission) {
  if (!user.permissions.includes(permission)) throw new HttpError(403, 'Seu usuário não tem permissão para isso');
  return user;
}

// O registro guarda só o essencial: textos longos e listas grandes são cortados
const AUDIT_MAX_TEXT = 300;
const AUDIT_MAX_JSON = 4000;
function trimDetails(value, depth = 0) {
  if (typeof value === 'string') return value.slice(0, AUDIT_MAX_TEXT);
  if (Array.isArray(value)) return value.slice(0, 30).map(v => trimDetails(v, depth + 1));
  if (value && typeof value === 'object') {
    if (depth > 3) return '[…]';
    return Object.fromEntries(Object.entries(value).slice(0, 40).map(([k, v]) => [k.slice(0, 60), trimDetails(v, depth + 1)]));
  }
  return value;
}

export async function audit(db, username, action, details = null) {
  let json = details ? JSON.stringify(trimDetails(details)) : null;
  if (json && json.length > AUDIT_MAX_JSON) json = JSON.stringify({ resumo: json.slice(0, AUDIT_MAX_JSON - 100) });
  await db.query('INSERT INTO audit_log (username, action, details) VALUES ($1, $2, $3)', [username, action, json]);
}
