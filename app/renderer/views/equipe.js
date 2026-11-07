// Equipe: usuários, papéis e registro de alterações (somente dono)
import { h, icon, btn, card, dateTime, toast, modal, field, input, select, skeleton, emptyState } from '../ui.js';
import { get, post, patch } from '../api.js';
import { state } from '../app.js';

const ROLES = [['dono', 'Dono'], ['atendente', 'Atendente'], ['cozinha', 'Cozinha']];
const ROLE_INFO = {
  dono: { icon: 'lock', tone: 'primary', text: 'Acesso total: cardápio, preços, horários, financeiro e equipe.' },
  atendente: { icon: 'user', tone: 'info', text: 'Pedidos (inclusive cancelar), histórico, caixa, pausar a loja e marcar esgotado.' },
  cozinha: { icon: 'flame', tone: 'warn', text: 'Quadro de pedidos (avançar status, imprimir) e marcar esgotado.' },
};

const ACTIONS = {
  'produto.criar': 'Criou produto', 'produto.editar': 'Editou produto', 'produto.excluir': 'Excluiu produto',
  'produto.esgotado': 'Marcou esgotado', 'produto.disponivel': 'Marcou disponível',
  'adicional.criar': 'Criou adicional', 'adicional.editar': 'Editou adicional', 'adicional.excluir': 'Excluiu adicional',
  'bairro.criar': 'Criou bairro', 'bairro.editar': 'Editou bairro', 'bairro.excluir': 'Excluiu bairro',
  'cupom.criar': 'Criou cupom', 'cupom.editar': 'Editou cupom', 'cupom.excluir': 'Excluiu cupom',
  'loja.editar': 'Alterou dados da loja', 'loja.pausar': 'Pausou pedidos', 'loja.retomar': 'Retomou pedidos',
  'caixa.open': 'Abriu o caixa', 'caixa.movement': 'Movimentou o caixa', 'caixa.close': 'Fechou o caixa',
  'despesa.criar': 'Lançou despesa', 'despesa.excluir': 'Excluiu despesa',
  'equipe.criar': 'Cadastrou usuário', 'equipe.editar': 'Alterou usuário',
};

function describe(entry) {
  const d = entry.details || {};
  const parts = [d.name, d.code, d.username, d.category, d.kind, d.amount !== undefined ? `R$ ${d.amount}` : null, d.countedAmount !== undefined ? `contado R$ ${d.countedAmount}` : null, d.pauseMessage].filter(v => v !== undefined && v !== null && v !== '');
  if (d.changes) parts.push(Object.entries(d.changes).map(([k, v]) => `${k}: ${typeof v === 'object' ? '…' : v}`).join(', '));
  return parts.join(' • ');
}

const rolePill = (role, label) => h('span', { class: `pill pill--${ROLE_INFO[role]?.tone || ''}` }, icon(ROLE_INFO[role]?.icon || 'user'), label);

function userForm(user, done) {
  const isNew = !user;
  const u = user || { username: '', displayName: '', role: 'atendente', active: true };
  const f = {
    username: input({ value: u.username, disabled: !isNew, maxlength: 32, placeholder: 'ex.: maria' }),
    displayName: input({ value: u.displayName, maxlength: 60 }),
    role: select(ROLES, u.role),
    password: input({ type: 'password', minlength: 10, autocomplete: 'new-password', placeholder: isNew ? 'mínimo 10 caracteres' : 'deixe em branco para manter' }),
    active: h('input', { type: 'checkbox', checked: u.active }),
  };
  const help = h('p', { class: 'hint' }, ROLE_INFO[u.role].text);
  f.role.addEventListener('change', () => { help.textContent = ROLE_INFO[f.role.value].text; });
  modal({
    title: isNew ? 'Novo usuário' : u.displayName,
    icon: isNew ? 'plus' : 'user',
    body: h('div', { class: 'form-grid' },
      field('Usuário (login)', f.username), field('Nome', f.displayName),
      h('div', { class: 'span-2' }, field('Papel', f.role), help),
      h('div', { class: 'span-2' }, field(isNew ? 'Senha' : 'Nova senha', f.password)),
      !isNew ? h('label', { class: 'check' }, f.active, 'Usuário ativo (pode entrar no app)') : null),
    actions: [...(isNew ? [] : [{
      // computador perdido, senha vazada, funcionário que saiu: derruba os logins abertos
      label: 'Encerrar sessões', icon: 'logout', left: true,
      onClick: async () => {
        await patch(`/api/admin/staff/${encodeURIComponent(u.username)}`, { revokeSessions: true });
        toast(`Sessões de ${u.displayName} encerradas. Será preciso entrar de novo.`);
        done();
      },
    }]), { label: 'Cancelar' }, {
      label: 'Salvar', kind: 'primary', icon: 'check', submit: true,
      onClick: async () => {
        if (isNew) {
          await post('/api/admin/staff', { username: f.username.value, displayName: f.displayName.value, role: f.role.value, password: f.password.value });
        } else {
          const body = { displayName: f.displayName.value, role: f.role.value, active: f.active.checked };
          if (f.password.value) body.password = f.password.value;
          await patch(`/api/admin/staff/${encodeURIComponent(u.username)}`, body);
        }
        toast('Usuário salvo');
        done();
      },
    }],
  });
}

export default {
  id: 'equipe',
  label: 'Equipe',
  subtitle: 'Quem usa o app, o que cada um pode fazer e quem alterou o quê.',
  icon: 'users',
  group: 'Gestão',
  permission: 'staff.manage',
  render(container, { actions }) {
    let tab = 'users';
    const tabs = h('div', { class: 'tabs', style: { marginBottom: '1rem' } });
    const body = h('div');
    container.append(tabs, body);
    actions.append(btn('Usuário', { icon: 'plus', kind: 'primary', size: 'sm', onclick: () => userForm(null, draw) }));

    async function drawUsers() {
      const { staff } = await get('/api/admin/staff');
      body.replaceChildren(h('div', { class: 'grid-2', style: { gridTemplateColumns: '1.6fr 1fr' } },
        card({ title: 'Usuários', subtitle: `${staff.filter(u => u.active).length} ativos`, icon: 'users', flush: true }, h('table', { class: 'table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Pessoa'), h('th', {}, 'Papel'), h('th', {}, 'Status'), h('th', {}))),
          h('tbody', {}, staff.map(u => h('tr', { class: u.active ? '' : 'is-off' },
            h('td', {}, h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, h('div', { class: 'avatar', style: { width: '30px', height: '30px', fontSize: '13px' } }, u.displayName.slice(0, 1).toUpperCase()),
              h('div', {}, h('strong', {}, u.displayName, u.username === state.user.username ? h('span', { class: 'faint' }, ' (você)') : null), h('div', { class: 'faint' }, u.username)))),
            h('td', {}, rolePill(u.role, u.roleLabel)),
            h('td', {}, u.active ? h('span', { class: 'pill pill--ok' }, 'Ativo') : h('span', { class: 'pill' }, 'Desativado')),
            h('td', { class: 'right' }, btn('', { icon: 'pencil', kind: 'ghost', size: 'sm', title: 'Editar', onclick: () => userForm(u, draw) }))))))),
        card({ title: 'O que cada papel faz', icon: 'lock' },
          h('div', { class: 'stack' }, ROLES.map(([id, label]) => h('div', {}, rolePill(id, label), h('p', { class: 'muted', style: { margin: '0.4rem 0 0' } }, ROLE_INFO[id].text)))))));
    }

    async function drawAudit() {
      const { entries } = await get('/api/admin/staff?audit=1');
      body.replaceChildren(card({ title: 'Registro de alterações', subtitle: 'Mudanças de status dos pedidos ficam no histórico de cada pedido.', icon: 'history', flush: true },
        entries.length ? h('table', { class: 'table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Quando'), h('th', {}, 'Quem'), h('th', {}, 'O quê'), h('th', {}, 'Detalhes'))),
          h('tbody', {}, entries.map(e => h('tr', {},
            h('td', { class: 'num faint' }, dateTime(e.at)), h('td', {}, h('strong', {}, e.username)),
            h('td', {}, ACTIONS[e.action] || e.action), h('td', { class: 'muted' }, describe(e)))))) : emptyState('Nada registrado ainda', '', 'history')));
    }

    function draw() {
      tabs.replaceChildren(...[['users', 'Usuários', 'users'], ['audit', 'Registro de alterações', 'history']].map(([id, label, i]) =>
        h('button', { class: tab === id ? 'is-active' : '', onclick: () => { tab = id; draw(); } }, icon(i, { size: 15 }), label)));
      body.replaceChildren(h('div', { class: 'card' }, skeleton(5)));
      (tab === 'users' ? drawUsers() : drawAudit()).catch(err => body.replaceChildren(h('div', { class: 'card' }, emptyState('Não foi possível carregar', err.message, 'wifiOff'))));
    }
    draw();
  },
};
