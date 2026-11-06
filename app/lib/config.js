// Configurações deste computador (servidor, impressora, som), em %APPDATA%/Universal Gestão/config.json
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export const DEFAULTS = {
  serverUrl: 'https://universalprensados.com.br',
  printerName: '',     // vazio = impressora padrão do Windows
  autoPrint: false,    // imprime a comanda sozinho quando chega pedido novo
  paperWidth: 80,      // 80 ou 58 mm (impressora térmica)
  copies: 1,
  sound: true,
};

const file = () => path.join(app.getPath('userData'), 'config.json');

export function normalizeServerUrl(value) {
  try {
    const url = new URL(String(value).trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    // http só para testes locais; em produção a API exige https
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function loadConfig() {
  try {
    const saved = JSON.parse(fs.readFileSync(file(), 'utf8'));
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(config) {
  const clean = Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, config[k] ?? DEFAULTS[k]]));
  clean.paperWidth = clean.paperWidth === 58 ? 58 : 80;
  clean.autoPrint = Boolean(clean.autoPrint);
  clean.sound = Boolean(clean.sound);
  clean.copies = Math.min(Math.max(Number(clean.copies) || 1, 1), 5);
  clean.printerName = String(clean.printerName || '').slice(0, 200);
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(clean, null, 2));
  return clean;
}
