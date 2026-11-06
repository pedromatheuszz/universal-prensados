// Chamadas à API passando pelo processo principal (window.gestao vem do preload)

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized = () => {};
let onConnection = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };
export const setConnectionHandler = (fn) => { onConnection = fn; };

export async function api(method, path, body) {
  const res = await window.gestao.api(method, path, body);
  onConnection(res.status !== 0, res.data?.error);
  if (res.status === 401) {
    onUnauthorized(res.data?.error);
    throw new ApiError(res.data?.error || 'Sessão expirada', 401);
  }
  if (!res.ok) throw new ApiError(res.data?.error || `Erro ${res.status}`, res.status);
  return res.data;
}

export const get = (path) => api('GET', path);
export const post = (path, body = {}) => api('POST', path, body);
export const patch = (path, body = {}) => api('PATCH', path, body);
export const del = (path) => api('DELETE', path);
