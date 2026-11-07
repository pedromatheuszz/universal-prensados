// Utilitários HTTP compartilhados pelas Netlify Functions
import crypto from 'crypto';

const MAX_BODY_BYTES = 32 * 1024;

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

/** Lê o corpo como um objeto JSON (nunca lista, texto solto ou null) de até 32 KB. */
export async function readJson(req) {
  if (!(req.headers.get('content-type') || '').includes('application/json')) {
    throw new HttpError(415, 'Envie os dados como JSON');
  }
  // recusa pelo tamanho declarado antes de ler, e confere de novo o que chegou de fato
  if (Number(req.headers.get('content-length')) > MAX_BODY_BYTES) throw new HttpError(413, 'Pedido grande demais');
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new HttpError(413, 'Pedido grande demais');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'JSON inválido');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Formato de dados inválido');
  return data;
}

export function clientIpHash(req, context) {
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'desconhecido';
  return crypto.createHash('sha256').update(`${ip}|${process.env.SESSION_SECRET || ''}`).digest('hex').slice(0, 32);
}

// Envolve o handler: converte HttpError em resposta JSON e esconde erros internos
export function handle(fn) {
  return async (req, context) => {
    try {
      return await fn(req, context);
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.message, ...(error.details ? { details: error.details } : {}) }, error.status);
      }
      console.error('[api]', error);
      return json({ error: 'Erro interno. Tente novamente.' }, 500);
    }
  };
}

export function methodNotAllowed(allowed) {
  return json({ error: 'Método não permitido' }, 405, { Allow: allowed.join(', ') });
}
