// Converte '/api/orders/:id' em regex e extrai os parâmetros (mesmo formato do config.path das funções)
export function toRegex(pattern) {
  const keys = [];
  const source = pattern.replace(/\/:([A-Za-z_]+)/g, (_, key) => { keys.push(key); return '/([^/]+)'; });
  return { regex: new RegExp(`^${source}/?$`), keys };
}

export function matchPath(patterns, pathname) {
  for (const pattern of [patterns].flat().filter(Boolean)) {
    const { regex, keys } = toRegex(pattern);
    const match = pathname.match(regex);
    if (match) return Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
  }
  return null;
}
