// Ponte segura entre a interface e o processo principal (a interface não tem acesso ao Node)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gestao', {
  api: (method, path, body) => ipcRenderer.invoke('api:request', { method, path, body }),
  login: (username, password, remember) => ipcRenderer.invoke('auth:login', { username, password, remember }),
  restoreSession: () => ipcRenderer.invoke('auth:restore'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (changes) => ipcRenderer.invoke('config:set', changes),
  listPrinters: () => ipcRenderer.invoke('print:list'),
  printHtml: (html) => ipcRenderer.invoke('print:html', { html }),
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
  setWindowTheme: (theme) => ipcRenderer.invoke('window:theme', theme),
});
