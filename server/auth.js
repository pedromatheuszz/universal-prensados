// Autenticação da equipe: senha com scrypt + sessão em cookie HttpOnly assinado (HMAC)
import crypto from 'crypto';
import { HttpError } from './http.js';

const COOKIE = 'up_staff';
const SESSION_HOURS = 14;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

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

export function createSessionCookie(username, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ u: username, exp: now + SESSION_HOURS * 3600 * 1000 })).toString('base64url');
  const secure = process.env.NODE_ENV === 'development' ? '' : '; Secure';
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${secure}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export function readSession(req, now = Date.now()) {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.split(';').map(c => c.trim()).find(c => c.startsWith(`${COOKIE}=`));
  if (!match) return null;
  const [payload, signature] = match.slice(COOKIE.length + 1).split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > now ? { username: data.u } : null;
  } catch {
    return null;
  }
}

export function requireStaff(req) {
  const session = readSession(req);
  if (!session) throw new HttpError(401, 'Faça login para continuar');
  return session;
}
