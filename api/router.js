// Função única da Vercel: o vercel.json reescreve /api/* para cá e o roteamento
// é feito em server/routes.js, com as mesmas funções usadas no Netlify.
import { routeRequest } from '../server/routes.js';

async function handler(request) {
  const url = new URL(request.url);
  // a reescrita manda o caminho original em ?__route=; sem ele, usa o próprio caminho
  const route = url.searchParams.get('__route');
  url.searchParams.delete('__route');
  const pathname = route != null ? `/api/${route.replace(/^\/+/, '')}` : url.pathname;
  url.pathname = pathname;
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
  const forwarded = new Request(url, { method: request.method, headers: request.headers, body });
  // a Vercel sobrescreve estes cabeçalhos com o IP real do cliente
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return routeRequest(forwarded, { ip, pathname });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
