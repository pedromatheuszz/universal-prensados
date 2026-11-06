// /api/admin/staff — equipe (somente dono)
//   GET               usuários
//   GET ?audit=1      registro de alterações (quem mudou o quê)
//   POST              { username, displayName, role, password }
//   PATCH /:username  { displayName, role, active, password }
import { getDb } from '../../server/db.js';
import { handle, json, readJson, methodNotAllowed } from '../../server/http.js';
import { requireStaff, audit, createToken } from '../../server/auth.js';
import { listStaff, createStaff, updateStaff, listAudit } from '../../server/staff.js';

export default handle(async (req, context) => {
  const db = getDb();
  const user = await requireStaff(req, db, 'staff.manage');
  const username = context.params?.username;

  if (!username) {
    if (req.method === 'GET') {
      if (new URL(req.url).searchParams.has('audit')) return json({ entries: await listAudit(db) });
      return json({ staff: await listStaff(db) });
    }
    if (req.method !== 'POST') return methodNotAllowed(['GET', 'POST']);
    const body = await readJson(req);
    const created = await createStaff(db, body);
    await audit(db, user.username, 'equipe.criar', { username: created, role: body.role });
    return json({ staff: await listStaff(db) }, 201);
  }

  if (req.method !== 'PATCH') return methodNotAllowed(['PATCH']);
  const body = await readJson(req);
  const target = username.toLowerCase();
  await updateStaff(db, target, body, user.username);
  const { password, ...logged } = body;
  await audit(db, user.username, 'equipe.editar', { username: target, ...logged, ...(password ? { senha: 'alterada' } : {}) });

  // quem trocou a própria senha recebe um token novo para não cair da sessão
  let token;
  if (target === user.username) {
    const [row] = await db.query('SELECT session_version FROM staff_users WHERE username = $1', [target]);
    token = createToken(target, row.session_version);
  }
  return json({ staff: await listStaff(db), ...(token ? { token } : {}) });
});

export const config = { path: ['/api/admin/staff', '/api/admin/staff/:username'] };
