// Ajustes deste computador: servidor, impressora, aviso sonoro, tema e inicialização
import { h, icon, btn, card, toast, field, input, select, toggle, skeleton } from '../ui.js';
import { state, ding, setTheme, printOrder, reloadConfig, logout } from '../app.js';

const SAMPLE_ORDER = {
  code: '#0000', createdAt: new Date().toISOString(), deliveryType: 'delivery', customerName: 'Teste de impressão', customerPhone: '47999990000',
  address: { street: 'Rua Exemplo', number: '123', compl: '', ref: 'Teste', cep: '' }, district: 'Centro',
  items: [{ qty: 1, name: 'Dogzão Especial', unitPrice: 17, extras: [{ name: 'Bacon Crocante' }], removals: ['Sem milho'], notes: 'Bem prensado' }],
  subtotal: 17, discount: 0, deliveryFee: 5, total: 22, paymentMethod: 'dinheiro', changeFor: '50',
};

const settingRow = (title, text, control) => h('div', { class: 'row', style: { flexWrap: 'nowrap', padding: '0.7rem 0', borderTop: '1px solid var(--border)' } },
  h('div', { style: { flex: 1 } }, h('strong', {}, title), text ? h('div', { class: 'faint', style: { fontSize: '12.5px' } }, text) : null), control);

function themeOption(value, label, iconName, current) {
  return h('button', {
    class: `chip ${current === value ? 'is-active' : ''}`,
    onclick: (e) => {
      setTheme(value);
      e.currentTarget.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c === e.currentTarget));
    },
  }, icon(iconName), label);
}

export default {
  id: 'ajustes',
  label: 'Ajustes',
  subtitle: 'Configurações deste computador: impressora, avisos, aparência e servidor.',
  icon: 'settings',
  group: 'Sistema',
  render(container) {
    async function save(changes, message = 'Ajuste salvo') {
      const res = await window.gestao.setConfig(changes);
      if (!res.ok) return toast(res.error, 'error');
      await reloadConfig();
      toast(message);
      return true;
    }

    async function draw() {
      const config = await reloadConfig();
      let printers = [];
      try { printers = await window.gestao.listPrinters(); } catch { /* sem impressoras */ }
      const theme = document.documentElement.dataset.theme;

      const server = input({ value: config.serverUrl });
      const printer = select([['', 'Impressora padrão do Windows'], ...printers.map(p => [p.name, `${p.displayName}${p.isDefault ? ' (padrão)' : ''}`])], config.printerName);
      const paper = select([[80, '80 mm'], [58, '58 mm']], config.paperWidth);
      const copies = select([1, 2, 3].map(n => [n, `${n} via${n > 1 ? 's' : ''}`]), config.copies);
      printer.addEventListener('change', () => save({ printerName: printer.value }, 'Impressora escolhida'));
      paper.addEventListener('change', () => save({ paperWidth: Number(paper.value) }));
      copies.addEventListener('change', () => save({ copies: Number(copies.value) }));

      container.replaceChildren(h('div', { class: 'grid-2' },
        h('div', { class: 'stack' },
          card({ title: 'Aviso de pedido novo', subtitle: 'Som, notificação do Windows e barra de tarefas piscando.', icon: 'bell' },
            settingRow('Tocar som', 'Três toques quando chega pedido do site', h('div', { class: 'row', style: { flexWrap: 'nowrap' } },
              btn('Testar', { icon: 'volume', size: 'sm', kind: 'ghost', onclick: () => ding({ force: true }) }), toggle(config.sound, (v) => save({ sound: v })))),
            settingRow('Abrir com o Windows', 'O app já abre quando o computador liga', toggle(config.openAtLogin, (v) => save({ openAtLogin: v })))),
          card({ title: 'Impressora de comandas', subtitle: 'Térmica de 80 ou 58 mm, ou qualquer impressora do Windows.', icon: 'printer' },
            h('div', { class: 'stack' },
              field('Impressora', printer),
              h('div', { class: 'form-grid' }, field('Largura do papel', paper), field('Cópias', copies))),
            h('div', { style: { marginTop: '0.8rem' } },
              settingRow('Impressão automática', 'Imprime a comanda sozinho quando chega pedido novo',
                toggle(config.autoPrint, (v) => save({ autoPrint: v }, v ? 'Impressão automática ligada' : 'Impressão automática desligada')))),
            h('div', { style: { marginTop: '0.6rem' } }, btn('Imprimir teste', { icon: 'printer', onclick: () => printOrder(SAMPLE_ORDER) })))),
        h('div', { class: 'stack' },
          card({ title: 'Aparência', subtitle: 'O tema escuro combina com a logo e cansa menos a vista à noite.', icon: theme === 'light' ? 'sun' : 'moon' },
            h('div', { class: 'chips' }, themeOption('dark', 'Escuro', 'moon', theme), themeOption('light', 'Claro', 'sun', theme))),
          card({
            tag: 'form', title: 'Servidor', subtitle: 'Endereço do site com a API. Trocar pede login de novo.', icon: 'server',
            onsubmit: async (e) => {
              e.preventDefault();
              if (server.value.trim().replace(/\/$/, '') === config.serverUrl) return;
              if (await save({ serverUrl: server.value }, 'Servidor alterado. Entre novamente.')) logout();
            },
          },
          h('div', { class: 'stack' }, field('Endereço do site', server), h('div', {}, btn('Salvar endereço', { icon: 'check', type: 'submit' })))),
          card({ title: 'Sobre', icon: 'info' },
            h('div', { class: 'row', style: { flexWrap: 'nowrap', alignItems: 'center' } },
              h('img', { src: 'assets/logo.webp', alt: '', style: { width: '52px', height: '52px', borderRadius: '50%' } }),
              h('div', { style: { flex: 1 } }, h('strong', {}, `Universal Gestão ${config.version}`),
                h('div', { class: 'faint' }, `${state.user.displayName} (${state.user.roleLabel}) • ${config.serverUrl.replace(/^https?:\/\//, '')}`)),
              btn('Sair', { icon: 'logout', kind: 'danger', size: 'sm', onclick: logout }))))));
    }

    container.append(h('div', { class: 'grid-2' }, h('div', { class: 'card' }, skeleton(5)), h('div', { class: 'card' }, skeleton(5))));
    draw();
  },
};
