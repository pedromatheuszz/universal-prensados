// Universal Gestão — processo principal do Electron.
// A interface (renderer/) roda isolada, sem Node; tudo que sai para a rede passa por aqui:
// o token de login fica só neste processo e as chamadas vão para a API do site (/api/admin/*).
import { app, BrowserWindow, ipcMain, protocol, net, Notification, shell, dialog, Menu, safeStorage, nativeImage, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { loadConfig, saveConfig, normalizeServerUrl } from './lib/config.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RENDERER = path.join(ROOT, 'renderer');
// Modo de desenvolvimento só fora do instalador (no app instalado, --dev é ignorado)
const DEV = !app.isPackaged && process.argv.includes('--dev');
const REFRESH_MS = 30 * 60 * 1000; // renova o token enquanto o app está aberto
const REQUEST_TIMEOUT_MS = 15000;

let win = null;
let token = null;
let quitting = false;

// Endereço da interface empacotada. Só ela pode chamar o processo principal.
const APP_ORIGIN = 'app://gestao';

function fromApp(event) {
  const url = event.senderFrame?.url || '';
  return Boolean(win) && event.sender === win.webContents && url.startsWith(`${APP_ORIGIN}/`);
}

// ipcMain.handle que recusa chamadas de qualquer outra página ou janela
function handle(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!fromApp(event)) throw new Error('Origem não autorizada');
    return fn(event, ...args);
  });
}

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
      // a API nunca redireciona: um redirecionamento levaria o token para outro endereço
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      data: { error: timeout ? 'O servidor demorou para responder' : `Sem conexão com o servidor (${serverUrl}). Confira a internet e o endereço em Ajustes.` },
    };
  }
}

const ALLOWED_METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];

// A interface só pode falar com as rotas da equipe, no servidor configurado.
// Confere o caminho já resolvido (pega truques como "%2e%2e" e "//outro-host").
function isAdminPath(apiPath) {
  if (typeof apiPath !== 'string' || !apiPath.startsWith('/api/admin/')) return false;
  try {
    const { serverUrl } = loadConfig();
    const url = new URL(apiPath, serverUrl);
    return url.origin === new URL(serverUrl).origin && url.pathname.startsWith('/api/admin/');
  } catch {
    return false;
  }
}

handle('api:request', async (_e, { method = 'GET', path: apiPath, body } = {}) => {
  if (!ALLOWED_METHODS.includes(method) || !isAdminPath(apiPath)) {
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

handle('auth:login', async (_e, { username, password, remember } = {}) => {
  if (typeof username !== 'string' || typeof password !== 'string') {
    return { ok: false, status: 400, data: { error: 'Informe usuário e senha' } };
  }
  const result = await callApi('POST', '/api/admin/session', { username, password });
  if (!result.ok) return result;
  token = result.data.token;
  await persistToken(remember ? token : null);
  return { ok: true, status: 200, data: { user: result.data.user } };
});

// Confere a sessão e troca o token por um novo (sessão deslizante)
async function refreshSession() {
  const result = await callApi('GET', '/api/admin/session');
  if (result.ok && typeof result.data?.token === 'string') {
    token = result.data.token;
    if (fs.existsSync(sessionFile())) await persistToken(token);
  }
  return result;
}

setInterval(() => { if (token) refreshSession(); }, REFRESH_MS).unref?.();

handle('auth:restore', async () => {
  token = token || (await readPersistedToken());
  if (!token) return null;
  const result = await refreshSession();
  if (result.ok) return result.data.user;
  if (result.status === 401) {
    token = null;
    await persistToken(null);
    return null;
  }
  return { offline: true, error: result.data.error };
});

handle('auth:logout', async () => {
  token = null;
  await persistToken(null);
  return true;
});

// ---------- Configurações locais (servidor, impressora, som) ----------

handle('config:get', () => ({
  ...loadConfig(),
  openAtLogin: app.getLoginItemSettings().openAtLogin,
  version: app.getVersion(),
}));

handle('config:set', (_e, changes) => {
  if (!changes || typeof changes !== 'object') return { ok: false, error: 'Ajuste inválido' };
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

handle('print:list', async () => {
  if (!win) return [];
  const printers = await win.webContents.getPrintersAsync();
  return printers.map(p => ({ name: p.name, displayName: p.displayName || p.name, isDefault: p.isDefault }));
});

handle('print:html', async (_e, { html } = {}) => {
  if (typeof html !== 'string' || html.length > 200000) return { ok: false, error: 'Comanda inválida' };
  const { printerName, paperWidth, copies } = loadConfig();
  // janela invisível e isolada; a comanda traz CSP própria (sem scripts) e o
  // 'web-contents-created' abaixo impede que ela navegue ou abra janelas
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, devTools: false, spellcheck: false },
  });
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

handle('notify', (_e, { title, body } = {}) => {
  if (Notification.isSupported()) {
    const n = new Notification({
      title: String(title ?? '').slice(0, 120),
      body: String(body ?? '').slice(0, 300),
      icon: path.join(ROOT, 'build/icon.png'),
      silent: true,
    });
    n.on('click', () => { if (win) { win.show(); win.focus(); } });
    n.show();
  }
  if (win && !win.isFocused()) win.flashFrame(true);
  return true;
});

// Só abre no navegador o WhatsApp e o próprio site (comparando a origem, não o começo do texto:
// "https://site.com.evil.com" não pode passar por "https://site.com")
handle('open:external', (_e, url) => {
  let allowed = false;
  try {
    const target = new URL(url);
    const { serverUrl } = loadConfig();
    allowed = target.origin === 'https://wa.me' || target.origin === new URL(serverUrl).origin;
  } catch { /* endereço inválido */ }
  if (allowed) shell.openExternal(url);
  return allowed;
});

// ---------- Janela ----------

function serveRenderer() {
  const notFound = () => new Response('Não encontrado', { status: 404 });
  protocol.handle('app', (request) => {
    try {
      const { host, pathname } = new URL(request.url);
      if (host !== 'gestao') return notFound();
      // só arquivos dentro de renderer/ (barra "..", "%2e%2e" e afins não escapam da pasta)
      const file = path.normalize(path.join(RENDERER, decodeURIComponent(pathname)));
      if (!file.startsWith(RENDERER + path.sep)) return notFound();
      return net.fetch(pathToFileURL(file).toString());
    } catch {
      return notFound();
    }
  });
}

// Vale para toda janela que o app criar (inclusive a invisível da impressão):
// nada de navegar para fora da interface, abrir janelas novas ou embutir <webview>
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (e) => e.preventDefault());
  contents.on('will-navigate', (e, url) => { if (!url.startsWith(`${APP_ORIGIN}/`)) e.preventDefault(); });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

// Cores da barra de título (os botões minimizar/maximizar/fechar são os nativos do Windows)
const TITLEBAR = {
  dark: { color: '#0c0c0e', symbolColor: '#f4f4f5', height: 44 },
  light: { color: '#ffffff', symbolColor: '#18181b', height: 44 },
};

handle('window:theme', (_e, theme) => {
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
      webviewTag: false,
      spellcheck: false,
      // ferramentas de desenvolvedor só fora do instalador
      devTools: !app.isPackaged,
    },
  });

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
  win.on('focus', () => win.flashFrame(false));

  // links do WhatsApp abrem no navegador; qualquer outra janela é recusada
  win.webContents.setWindowOpenHandler(({ url }) => {
    try { if (new URL(url).origin === 'https://wa.me') shell.openExternal(url); } catch { /* ignorado */ }
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

  win.loadURL(`${APP_ORIGIN}/index.html`);
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
  // a interface não usa câmera, microfone, localização, notificações web etc.: tudo negado
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  app.setAppUserModelId('br.com.universalprensados.gestao');
  serveRenderer();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
