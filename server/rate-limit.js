// Limites de tentativas guardados no banco (as funções serverless não têm memória entre chamadas).
// A chave (IP, usuário) é gravada só como hash com o segredo do servidor, nunca em texto.
import crypto from 'crypto';

export const keyHash = (key) =>
  crypto.createHash('sha256').update(`${String(key)}|${process.env.SESSION_SECRET || ''}`).digest('hex').slice(0, 32);

export async function countEvents(db, bucket, key, minutes) {
  const [row] = await db.query(
    `SELECT count(*)::int AS n FROM rate_events
      WHERE bucket = $1 AND key_hash = $2 AND created_at > now() - ($3::int * interval '1 minute')`,
    [bucket, keyHash(key), minutes]
  );
  return row.n;
}

export async function addEvent(db, bucket, key) {
  await db.query('INSERT INTO rate_events (bucket, key_hash) VALUES ($1, $2)', [bucket, keyHash(key)]);
  // a tabela só precisa da janela recente
  await db.query("DELETE FROM rate_events WHERE created_at < now() - interval '1 day'");
}

export async function clearEvents(db, bucket, key) {
  await db.query('DELETE FROM rate_events WHERE bucket = $1 AND key_hash = $2', [bucket, keyHash(key)]);
}
