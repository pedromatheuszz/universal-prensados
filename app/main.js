// Universal Gestão — processo principal do Electron.
// A interface (renderer/) roda isolada, sem Node; tudo que sai para a rede passa por aqui:
// o token de login fica só neste processo e as chamadas vão para a API do site (/api/admin/*).
import { app, BrowserWindow, ipcMain, protocol, net, Notification, shell, dialog, Menu, safeStorage, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { loadConfig, saveConfig, normalizeServerUrl } from './lib/config.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RENDERER = path.join(ROOT, 'renderer');
const DEV = process.argv.includes('--dev');
const REQUEST_TIMEOUT_MS = 15000;

let win = null;
let token = null;
let quitting = false;

// Só em desenvolvimento: perfil separado (testes automáticos não mexem na sessão real)
if (DEV && process.env.GESTAO_USER_DATA) app.setPath('userData', process.env.GESTAO_USER_DATA);

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// ---------- Sessão (token guardado criptografado pelo Windows) ----------

const sessionFile = () => path.join(app.getPath('userData'), 'session.bin');

async function persistToken(value) {
  try {
    if (!value) return fs.rmSync(sessionFile(), { force: true });
    if (await safeStorage.isAsyncEncryptionAvailable()) fs.writeFileSync(sessionFile(), await safeStorage.encryptStringAsync(value));
  } catch { /* sem disco: a sessão vale só enquanto o app estiver aberto */ }
}

async function readPersistedToken() {
  try {
    if (!fs.existsSync(sessionFile()) || !(await safeStorage.isAsyncEncryptionAvailable())) return null;
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(fs.readFileSync(sessionFile()));
    if (shouldReEncrypt) await persistToken(result);
    return result;
  } catch {
    return null;
  }
}

// ---------- Chamadas à API ----------

async function callApi(method, apiPath, body) {
  const { serverUrl } = loadConfig();
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await net.fetch(new URL(apiPath, serverUrl).toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return { ok: false, status: 0, data: { error: timeout ? 'O servidor demorou para responder' : `Sem conexão com o servidor (${serverUrl})` } };
  }
}

const ALLOWED_METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];

ipcMain.handle('api:request', async (_e, { method = 'GET', path: apiPath, body } = {}) => {
  // a interface só pode falar com as rotas da equipe
  if (!ALLOWED_METHODS.includes(method) || typeof apiPath !== 'string' || !apiPath.startsWith('/api/admin/') || apiPath.includes('..')) {
    return { ok: false, status: 400, data: { error: 'Requisição inválida' } };
  }
  const result = await callApi(method, apiPath, body);
  if (result.status === 401) {
    token = null;
    await persistToken(null);
  }
  // trocar a própria senha devolve um token novo
  if (result.ok && typeof result.data?.token === 'string') {
    token = result.data.token;
    if (fs.existsSync(sessionFile())) await persistToken(token);
    delete result.data.token;
  }
  return result;
});

ipcMain.handle('auth:login', async (_e, { username, password, remember }) => {
  const result = await callApi('POST', '/api/admin/session', { username, password });
  if (!result.ok) return result;
  token = result.data.token;
  await persistToken(remember ? token : null);
  return { ok: true, status: 200, data: { user: result.data.user } };
});

ipcMain.handle('auth:restore', async () => {
  token = token || (await readPersistedToken());
  if (!token) return null;
  const result = await callApi('GET', '/api/admin/session');
  if (result.ok) return result.data.user;
  if (result.status === 401) {
    token = null;
    await persistToken(null);
    return null;
  }
  return { offline: true, error: result.data.error };
});

ipcMain.handle('auth:logout', async () => {
  token = null;
  await persistToken(null);
  return true;
});

// ---------- Configurações locais (servidor, impressora, som) ----------

ipcMain.handle('config:get', () => ({
  ...loadConfig(),
  openAtLogin: app.getLoginItemSettings().openAtLogin,
  version: app.getVersion(),
}));

ipcMain.handle('config:set', (_e, changes = {}) => {
  const current = loadConfig();
  const next = { ...current };
  if (changes.serverUrl !== undefined) {
    const url = normalizeServerUrl(changes.serverUrl);
    if (!url) return { ok: false, error: 'Endereço inválido. Exemplo: https://universalprensados.com.br' };
    if (url !== current.serverUrl) {
      token = null; // outro servidor, outro login
      persistToken(null);
    }
    next.serverUrl = url;
  }
  for (const key of ['printerName', 'autoPrint', 'paperWidth', 'sound', 'copies']) {
    if (changes[key] !== undefined) next[key] = changes[key];
  }
  if (typeof changes.openAtLogin === 'boolean' && app.isPackaged) app.setLoginItemSettings({ openAtLogin: changes.openAtLogin });
  return { ok: true, config: saveConfig(next) };
});

// ---------- Impressão de comandas ----------

ipcMain.handle('print:list', async () => {
  if (!win) return [];
  const printers = await win.webContents.getPrintersAsync();
  return printers.map(p => ({ name: p.name, displayName: p.displayName || p.name, isDefault: p.isDefault }));
});

ipcMain.handle('print:html', async (_e, { html }) => {
  const { printerName, paperWidth, copies } = loadConfig();
  const printWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const contentHeight = await printWin.webContents.executeJavaScript('document.body.scrollHeight', true).catch(() => 1000);
    const widthMicrons = (paperWidth === 58 ? 58 : 80) * 1000;
    const heightMicrons = Math.max(100000, Math.ceil((contentHeight + 40) * 264.58)); // px → mícrons (96 dpi)
    return await new Promise((resolve) => {
      printWin.webContents.print({
        silent: true,
        printBackground: false,
        deviceName: printerName || undefined,
        copies: Math.min(Math.max(Number(copies) || 1, 1), 5),
        margins: { marginType: 'none' },
        pageSize: { width: widthMicrons, height: heightMicrons },
      }, (success, reason) => resolve(success ? { ok: true } : { ok: false, error: reason || 'Falha ao imprimir' }));
    });
  } finally {
    printWin.destroy();
  }
});

// ---------- Avisos ----------

ipcMain.handle('notify', (_e, { title, body }) => {
  if (Notification.isSupported()) {
    const n = new Notification({ title, body, icon: path.join(ROOT, 'build/icon.png'), silent: true });
    n.on('click', () => { if (win) { win.show(); win.focus(); } });
    n.show();
  }
  if (win && !win.isFocused()) win.flashFrame(true);
  return true;
});

ipcMain.handle('open:external', (_e, url) => {
  const { serverUrl } = loadConfig();
  const allowed = typeof url === 'string' && (url.startsWith('https://wa.me/') || url.startsWith(serverUrl));
  if (allowed) shell.openExternal(url);
  return allowed;
});

// ---------- Janela ----------

function serveRenderer() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(path.join(RENDERER, decodeURIComponent(pathname)));
    if (!file.startsWith(RENDERER + path.sep)) return new Response('Não encontrado', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

// Cores da barra de título (os botões minimizar/maximizar/fechar são os nativos do Windows)
const TITLEBAR = {
  dark: { color: '#0c0c0e', symbolColor: '#f4f4f5', height: 44 },
  light: { color: '#ffffff', symbolColor: '#18181b', height: 44 },
};

ipcMain.handle('window:theme', (_e, theme) => {
  if (win && process.platform === 'win32') win.setTitleBarOverlay(TITLEBAR[theme === 'light' ? 'light' : 'dark']);
  return true;
});

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0c0c0e',
    title: 'Universal Gestão',
    titleBarStyle: 'hidden',
    titleBarOverlay: TITLEBAR.dark,
    icon: nativeImage.createFromPath(path.join(ROOT, 'build/icon.png')),
    show: false,
    webPreferences: {
      preload: path.join(ROOT, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
  win.on('focus', () => win.flashFrame(false));

  // nada de navegar para fora da interface; links externos abrem no navegador
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) e.preventDefault(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://wa.me/')) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('close', (e) => {
    if (quitting || DEV) return;
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Fechar o app', 'Continuar aberto'],
      defaultId: 1,
      cancelId: 1,
      title: 'Fechar o Universal Gestão?',
      message: 'Fechar o app de gestão?',
      detail: 'Com o app fechado você não recebe o aviso de pedidos novos do site.',
    });
    if (choice === 1) e.preventDefault();
    else quitting = true;
  });

  win.loadURL('app://gestao/index.html');
  if (DEV && process.env.GESTAO_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' });
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

app.whenReady().then(() => {
  if (DEV && (process.env.GESTAO_SERVER || !fs.existsSync(path.join(app.getPath('userData'), 'config.json')))) {
    saveConfig({ ...loadConfig(), serverUrl: process.env.GESTAO_SERVER || 'http://localhost:3000' });
  }
  if (!DEV) Menu.setApplicationMenu(null);
  app.setAppUserModelId('br.com.universalprensados.gestao');
  serveRenderer();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
