// Loja e entrega: pausa, dados da loja, horários, bairros/taxas e cupons
import { h, icon, btn, card, money, toast, modal, field, input, toggle, confirmDialog, moneyInput, parseMoney, skeleton, emptyState } from '../ui.js';
import { get, post, patch, del } from '../api.js';
import { can, state, refreshStore, togglePause } from '../app.js';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function districtForm(d, done) {
  const isNew = !d;
  const v = d || { name: '', slug: '', fee: 0, active: true, order: 0 };
  const f = {
    name: input({ value: v.name, maxlength: 60 }),
    fee: input({ value: moneyInput(v.fee), money: true }),
    slug: input({ value: v.slug, maxlength: 60, placeholder: 'ex.: joao costa' }),
    order: input({ value: v.order, type: 'number' }),
    active: h('input', { type: 'checkbox', checked: v.active }),
  };
  modal({
    title: isNew ? 'Novo bairro' : v.name,
    icon: 'map',
    body: h('div', { class: 'form-grid' },
      field('Bairro', f.name), field('Taxa de entrega (R$)', f.fee),
      field('Nome para busca do CEP', f.slug, 'Como os Correios escrevem o bairro, sem acento'), field('Ordem', f.order),
      h('label', { class: 'check' }, f.active, 'Atendemos este bairro')),
    actions: [
      !isNew ? { label: 'Excluir', kind: 'danger', icon: 'trash', left: true, onClick: async () => {
        if (!(await confirmDialog(`Excluir o bairro ${v.name}?`, { danger: true, confirmLabel: 'Excluir', title: 'Excluir bairro' }))) return false;
        await del(`/api/admin/catalog/districts/${v.id}`);
        done();
      } } : null,
      { label: 'Cancelar' },
      { label: 'Salvar', kind: 'primary', icon: 'check', submit: true, onClick: async () => {
        const body = { name: f.name.value, fee: parseMoney(f.fee.value), slug: f.slug.value, order: Number(f.order.value), active: f.active.checked };
        if (isNew) await post('/api/admin/catalog/districts', body);
        else await patch(`/api/admin/catalog/districts/${v.id}`, body);
        toast('Bairro salvo');
        done();
      } },
    ].filter(Boolean),
  });
}

function couponForm(c, done) {
  const isNew = !c;
  const v = c || { code: '', discountPercent: 10, description: '', active: true };
  const f = {
    code: input({ value: v.code, maxlength: 30, disabled: !isNew, placeholder: 'EX.: NATAL15' }),
    pct: input({ value: v.discountPercent, type: 'number', min: 1, max: 100, step: 1 }),
    desc: input({ value: v.description, maxlength: 200 }),
    active: h('input', { type: 'checkbox', checked: v.active }),
  };
  modal({
    title: isNew ? 'Novo cupom' : `Cupom ${v.code}`,
    icon: 'tag',
    body: h('div', { class: 'form-grid' },
      field('Código', f.code), field('Desconto (%)', f.pct),
      h('div', { class: 'span-2' }, field('Descrição', f.desc)),
      h('label', { class: 'check' }, f.active, 'Cupom ativo')),
    actions: [
      !isNew ? { label: 'Excluir', kind: 'danger', icon: 'trash', left: true, onClick: async () => {
        if (!(await confirmDialog(`Excluir o cupom ${v.code}?`, { danger: true, confirmLabel: 'Excluir', title: 'Excluir cupom' }))) return false;
        await del(`/api/admin/catalog/coupons/${encodeURIComponent(v.code)}`);
        done();
      } } : null,
      { label: 'Cancelar' },
      { label: 'Salvar', kind: 'primary', icon: 'check', submit: true, onClick: async () => {
        const body = { discountPercent: Number(f.pct.value), description: f.desc.value, active: f.active.checked };
        if (isNew) await post('/api/admin/catalog/coupons', { code: f.code.value, ...body });
        else await patch(`/api/admin/catalog/coupons/${encodeURIComponent(v.code)}`, body);
        toast('Cupom salvo');
        done();
      } },
    ].filter(Boolean),
  });
}

export default {
  id: 'loja',
  label: 'Loja e entrega',
  subtitle: 'Situação da loja, horários, bairros atendidos e cupons do site.',
  icon: 'store',
  group: 'Loja',
  permission: 'orders.view',
  render(container) {
    const editable = can('store.edit');

    async function load() {
      if (!container.childElementCount) container.append(h('div', { class: 'grid-2' }, h('div', { class: 'card' }, skeleton(6)), h('div', { class: 'card' }, skeleton(8))));
      try {
        const [catalog] = await Promise.all([get('/api/admin/catalog'), refreshStore()]);
        draw(catalog);
      } catch (error) {
        container.replaceChildren(h('div', { class: 'card' }, emptyState('Não foi possível carregar', error.message, 'wifiOff')));
      }
    }

    function draw(catalog) {
      const { settings, status } = state.store;
      const tone = status.paused ? 'warn' : status.open ? 'ok' : 'danger';

      // --- Situação ---
      const situation = card({ title: 'Situação agora', subtitle: 'O site só aceita pedidos com a loja aberta e sem pausa.', icon: 'store' },
        h('div', { class: `banner ${tone === 'danger' ? 'banner--danger' : tone === 'ok' ? 'banner--ok' : ''}`, style: { margin: 0 } },
          h('span', { class: `dot dot--${tone} ${status.open ? 'dot--live' : ''}` }), status.label,
          can('store.pause') ? btn(settings.paused ? 'Retomar' : 'Pausar', { icon: settings.paused ? 'play' : 'pause', kind: settings.paused ? 'ok' : 'primary', size: 'sm', onclick: () => togglePause().then(load).catch(e => toast(e.message, 'error')) }) : null));

      // --- Dados da loja ---
      const f = {
        storeName: input({ value: settings.storeName, disabled: !editable }),
        whatsappPhone: input({ value: settings.whatsappPhone, disabled: !editable, placeholder: '5547999999999' }),
        freeShipping: input({ value: moneyInput(settings.freeShippingThreshold), money: true, disabled: !editable }),
      };
      const info = card({
        tag: 'form', title: 'Dados da loja', subtitle: 'Aparecem no site e na comanda.', icon: 'info',
        onsubmit: async (e) => {
          e.preventDefault();
          try {
            await patch('/api/admin/store', { storeName: f.storeName.value, whatsappPhone: f.whatsappPhone.value, freeShippingThreshold: parseMoney(f.freeShipping.value) });
            toast('Dados da loja salvos');
            load();
          } catch (error) { toast(error.message, 'error'); }
        },
      },
      h('div', { class: 'stack' },
        field('Nome', f.storeName),
        h('div', { class: 'form-grid' },
          field('WhatsApp que recebe os pedidos', f.whatsappPhone, '55 + DDD + número'),
          field('Frete grátis a partir de (R$)', f.freeShipping, '0 = nunca cobrar entrega')),
        editable ? h('div', {}, btn('Salvar dados', { icon: 'check', kind: 'primary', type: 'submit' })) : null));

      // --- Horários ---
      const rows = ORDER.map(day => {
        const hrs = settings.hours[day];
        const open = h('input', { type: 'checkbox', checked: !!hrs, disabled: !editable });
        const from = input({ type: 'time', value: hrs?.open || '19:00', disabled: !editable || !hrs });
        const until = input({ type: 'time', value: hrs?.close || '23:30', disabled: !editable || !hrs });
        const closed = h('span', { class: 'faint', hidden: !!hrs }, 'Fechado');
        const times = h('div', { class: 'hours__times', hidden: !hrs }, from, h('span', { class: 'faint' }, 'às'), until);
        open.addEventListener('change', () => {
          from.disabled = until.disabled = !open.checked;
          times.hidden = !open.checked;
          closed.hidden = open.checked;
        });
        return { day, open, from, until, el: h('div', { class: 'hours__row' },
          h('strong', {}, DAYS[day]), h('label', { class: 'check' }, open, 'Abre'), h('div', {}, times, closed)) };
      });
      const hours = card({
        tag: 'form', title: 'Horário de funcionamento', subtitle: 'Horário de Brasília. Fora dele o site mostra a loja fechada.', icon: 'clock',
        onsubmit: async (e) => {
          e.preventDefault();
          const grid = Array(7).fill(null);
          rows.forEach(r => { grid[r.day] = r.open.checked ? { open: r.from.value, close: r.until.value } : null; });
          try {
            await patch('/api/admin/store', { hours: grid });
            toast('Horários salvos');
            load();
          } catch (error) { toast(error.message, 'error'); }
        },
      },
      h('div', { class: 'hours' }, rows.map(r => r.el)),
      editable ? h('div', { style: { marginTop: '0.9rem' } }, btn('Salvar horários', { icon: 'check', kind: 'primary', type: 'submit' })) : null);

      // --- Bairros ---
      const active = catalog.districts.filter(d => d.active).length;
      const districts = card({
        title: 'Bairros e taxas de entrega', subtitle: `${active} de ${catalog.districts.length} bairros atendidos`, icon: 'map', flush: true,
        actions: editable ? btn('Bairro', { icon: 'plus', kind: 'primary', size: 'sm', onclick: () => districtForm(null, load) }) : null,
      },
      h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Bairro'), h('th', { class: 'right' }, 'Taxa'), h('th', {}, 'Atende'), h('th', {}))),
        h('tbody', {}, catalog.districts.map(d => h('tr', { class: d.active ? '' : 'is-off' },
          h('td', {}, h('strong', {}, d.name)), h('td', { class: 'right num' }, h('span', { class: 'price' }, money(d.fee))),
          h('td', {}, toggle(d.active, async (v) => {
            try { await patch(`/api/admin/catalog/districts/${d.id}`, { active: v }); toast(`${d.name}: ${v ? 'atendido' : 'não atendido'}`); } catch (e) { toast(e.message, 'error'); }
            load();
          }, { disabled: !editable })),
          h('td', { class: 'right' }, editable ? btn('', { icon: 'pencil', kind: 'ghost', size: 'sm', title: 'Editar', onclick: () => districtForm(d, load) }) : ''))))));

      // --- Cupons ---
      const coupons = card({
        title: 'Cupons de desconto', subtitle: 'O cliente digita o código no carrinho.', icon: 'tag', flush: true,
        actions: editable ? btn('Cupom', { icon: 'plus', kind: 'primary', size: 'sm', onclick: () => couponForm(null, load) }) : null,
      },
      catalog.coupons.length ? h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Código'), h('th', { class: 'right' }, 'Desconto'), h('th', {}, 'Descrição'), h('th', {}, 'Status'), h('th', {}))),
        h('tbody', {}, catalog.coupons.map(c => h('tr', { class: c.active ? '' : 'is-off' },
          h('td', {}, h('span', { class: 'pill pill--primary' }, icon('tag'), c.code)), h('td', { class: 'right num' }, h('strong', {}, `${c.discountPercent}%`)), h('td', { class: 'muted' }, c.description),
          h('td', {}, c.active ? h('span', { class: 'pill pill--ok' }, 'Ativo') : h('span', { class: 'pill' }, 'Inativo')),
          h('td', { class: 'right' }, editable ? btn('', { icon: 'pencil', kind: 'ghost', size: 'sm', title: 'Editar', onclick: () => couponForm(c, load) }) : ''))))) : emptyState('Nenhum cupom cadastrado', '', 'tag'));

      container.replaceChildren(
        editable ? '' : h('div', { class: 'banner banner--info' }, icon('lock'), 'Você pode pausar os pedidos, mas só o dono altera horários, taxas e cupons.'),
        h('div', { class: 'grid-2' }, h('div', { class: 'stack' }, situation, info, hours), h('div', { class: 'stack' }, districts, coupons)));
    }

    load();
  },
};
