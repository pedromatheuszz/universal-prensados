// Cardápio: produtos (preço, esgotado, ativo, edição) e adicionais. Mudanças aparecem no site na hora.
import { h, icon, btn, money, toast, modal, field, input, select, textarea, toggle, confirmDialog, moneyInput, parseMoney, searchInput, skeleton, emptyState } from '../ui.js';
import { get, post, patch, del } from '../api.js';
import { can } from '../app.js';

const CATEGORIES = [['salgados', 'Salgados'], ['especiais', 'Especiais'], ['combos', 'Combos'], ['doces', 'Doces'], ['bebidas', 'Bebidas']];

let catalog = null;

const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);

function productForm(product, onSaved) {
  const isNew = !product;
  const p = product || { id: '', name: '', category: 'salgados', price: 0, desc: '', image: '', badge: '', hasExtras: true, active: true, order: 100 };
  const images = [...new Set(catalog.products.map(x => x.image).filter(Boolean))].sort();
  const f = {
    name: input({ value: p.name, maxlength: 80, required: true }),
    id: input({ value: p.id, maxlength: 40, disabled: !isNew, placeholder: 'gerado pelo nome' }),
    category: select(CATEGORIES, p.category),
    price: input({ value: moneyInput(p.price), money: true, inputmode: 'decimal' }),
    desc: textarea(p.desc, { maxlength: 400 }),
    image: input({ value: p.image, list: 'image-list', placeholder: 'ex.: dogzao.png' }),
    badge: input({ value: p.badge, maxlength: 40, placeholder: 'ex.: 🔥 Mais Pedido' }),
    order: input({ value: p.order, type: 'number', step: 1 }),
    hasExtras: h('input', { type: 'checkbox', checked: p.hasExtras }),
    active: h('input', { type: 'checkbox', checked: p.active }),
  };
  if (isNew) f.name.addEventListener('input', () => { f.id.value = slugify(f.name.value); });

  modal({
    title: isNew ? 'Novo produto' : p.name,
    icon: isNew ? 'plus' : 'pencil',
    wide: true,
    body: h('div', { class: 'form-grid' },
      h('div', { class: 'span-2' }, field('Nome no cardápio', f.name)),
      field('Categoria', f.category),
      field('Preço (R$)', f.price),
      h('div', { class: 'span-2' }, field('Descrição', f.desc)),
      field('Imagem', f.image, 'Nome de uma imagem já usada no site. Imagens novas são adicionadas pelo desenvolvedor.'),
      field('Selo (opcional)', f.badge),
      field('Ordem no cardápio', f.order, 'Menor aparece primeiro'),
      field('Código interno', f.id, isNew ? 'Letras minúsculas, números e _' : 'Não pode ser alterado'),
      h('label', { class: 'check' }, f.hasExtras, 'Permite adicionais e remoções'),
      h('label', { class: 'check' }, f.active, 'Aparece no site (ativo)'),
      h('datalist', { id: 'image-list' }, images.map(i => h('option', { value: i })))),
    actions: [
      !isNew ? {
        label: 'Excluir', kind: 'danger', icon: 'trash', left: true,
        onClick: async () => {
          if (!(await confirmDialog(`Excluir "${p.name}" do cardápio? Para tirar do site só por um tempo, prefira desligar "No site".`, { danger: true, confirmLabel: 'Excluir', title: 'Excluir produto' }))) return false;
          catalog = await del(`/api/admin/catalog/products/${p.id}`);
          toast('Produto excluído');
          onSaved();
        },
      } : null,
      { label: 'Cancelar' },
      {
        label: 'Salvar', kind: 'primary', icon: 'check', submit: true,
        onClick: async () => {
          const body = {
            name: f.name.value, category: f.category.value, price: parseMoney(f.price.value), desc: f.desc.value,
            image: f.image.value, badge: f.badge.value, order: Number(f.order.value), hasExtras: f.hasExtras.checked, active: f.active.checked,
          };
          if (!(body.price >= 0)) throw new Error('Preço inválido');
          catalog = isNew ? await post('/api/admin/catalog/products', { id: f.id.value, ...body }) : await patch(`/api/admin/catalog/products/${p.id}`, body);
          toast(isNew ? 'Produto criado' : 'Produto atualizado');
          onSaved();
        },
      },
    ].filter(Boolean),
  });
}

function extraForm(extra, onSaved) {
  const isNew = !extra;
  const e = extra || { id: '', name: '', label: '', price: 0, active: true, order: catalog.extras.length };
  const f = {
    name: input({ value: e.name, maxlength: 60 }),
    label: input({ value: e.label, maxlength: 80, placeholder: 'Texto no site, ex.: + Bacon Crocante Extra' }),
    price: input({ value: moneyInput(e.price), money: true }),
    order: input({ value: e.order, type: 'number' }),
    active: h('input', { type: 'checkbox', checked: e.active }),
  };
  modal({
    title: isNew ? 'Novo adicional' : e.name,
    icon: isNew ? 'plus' : 'pencil',
    body: h('div', { class: 'form-grid' },
      field('Nome', f.name, 'Aparece na comanda'), field('Preço (R$)', f.price),
      h('div', { class: 'span-2' }, field('Texto no site', f.label)), field('Ordem', f.order),
      h('label', { class: 'check', style: { alignSelf: 'end', paddingBottom: '0.6rem' } }, f.active, 'Disponível no site')),
    actions: [
      !isNew ? {
        label: 'Excluir', kind: 'danger', icon: 'trash', left: true,
        onClick: async () => {
          if (!(await confirmDialog(`Excluir o adicional "${e.name}"?`, { danger: true, confirmLabel: 'Excluir', title: 'Excluir adicional' }))) return false;
          catalog = await del(`/api/admin/catalog/extras/${e.id}`);
          onSaved();
        },
      } : null,
      { label: 'Cancelar' },
      {
        label: 'Salvar', kind: 'primary', icon: 'check', submit: true,
        onClick: async () => {
          const body = { name: f.name.value, label: f.label.value, price: parseMoney(f.price.value), order: Number(f.order.value), active: f.active.checked };
          catalog = isNew ? await post('/api/admin/catalog/extras', { id: slugify(f.name.value), ...body }) : await patch(`/api/admin/catalog/extras/${e.id}`, body);
          toast('Adicional salvo');
          onSaved();
        },
      },
    ].filter(Boolean),
  });
}

export default {
  id: 'cardapio',
  label: 'Cardápio',
  subtitle: 'Preços, produtos esgotados e adicionais. Tudo muda no site na hora.',
  icon: 'utensils',
  group: 'Loja',
  permission: 'orders.view',
  render(container, { actions }) {
    const editable = can('catalog.edit');
    let tab = 'products';
    let filter = '';
    let category = 'all';
    const body = h('div');
    const tabs = h('div', { class: 'tabs' });
    const chips = h('div', { class: 'chips' });
    const search = searchInput({ placeholder: 'Buscar produto…', oninput: () => { filter = search.input.value.toLowerCase(); draw(); } });
    search.style.width = '260px';
    container.append(h('div', { class: 'toolbar' }, tabs, chips, h('div', { class: 'spacer' }), search), body);
    if (editable) {
      actions.append(btn('Novo', { icon: 'plus', kind: 'primary', size: 'sm', onclick: () => (tab === 'products' ? productForm(null, draw) : extraForm(null, draw)) }));
    }

    async function setFlag(product, changes, label) {
      try {
        catalog = await patch(`/api/admin/catalog/products/${product.id}`, changes);
        toast(label);
      } catch (error) {
        toast(error.message, 'error');
      }
      draw();
    }

    function drawProducts() {
      const list = catalog.products.filter(p => (!filter || p.name.toLowerCase().includes(filter)) && (category === 'all' || p.category === category));
      const soldOut = catalog.products.filter(p => p.soldOut && p.active).length;
      const groups = CATEGORIES.filter(([cat]) => list.some(p => p.category === cat));
      body.replaceChildren(
        soldOut ? h('div', { class: 'banner' }, icon('ban'), `${soldOut} produto${soldOut > 1 ? 's' : ''} marcado${soldOut > 1 ? 's' : ''} como esgotado no site`) : '',
        h('div', { class: 'card card--flush' }, groups.length ? groups.map(([cat, label]) => {
          const items = list.filter(p => p.category === cat);
          return [h('h3', { class: 'cat-title' }, label, h('span', { class: 'pill' }, String(items.length))), h('table', { class: 'table table--menu' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Produto'), h('th', { class: 'right' }, 'Preço'), h('th', {}, 'Esgotado'), h('th', {}, 'No site'), h('th', {}))),
            h('tbody', {}, items.map(p => h('tr', { class: p.active ? '' : 'is-off' },
              h('td', {}, h('div', { class: 'product-name' }, p.name, p.badge ? h('span', { class: 'pill pill--primary' }, p.badge) : '', p.soldOut ? h('span', { class: 'pill pill--danger' }, icon('ban'), 'Esgotado') : ''), h('div', { class: 'product-desc' }, p.desc)),
              h('td', { class: 'right num' }, h('span', { class: 'price' }, money(p.price))),
              h('td', {}, toggle(p.soldOut, (v) => setFlag(p, { soldOut: v }, v ? `${p.name}: esgotado` : `${p.name}: disponível`), { disabled: !can('stock.toggle') })),
              h('td', {}, toggle(p.active, (v) => setFlag(p, { active: v }, v ? `${p.name} voltou ao site` : `${p.name} saiu do site`), { disabled: !editable })),
              h('td', { class: 'right' }, editable ? btn('', { icon: 'pencil', kind: 'ghost', size: 'sm', title: 'Editar', onclick: () => productForm(p, draw) }) : '')))))];
        }) : emptyState('Nenhum produto encontrado', 'Tente outra busca ou categoria.', 'search')),
      );
    }

    function drawExtras() {
      body.replaceChildren(h('div', { class: 'card card--flush' },
        h('p', { class: 'muted', style: { margin: 0, padding: '1rem 1.25rem 0.25rem' } }, 'Adicionais oferecidos na personalização dos lanches (para produtos que permitem adicionais).'),
        h('table', { class: 'table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Adicional'), h('th', {}, 'Texto no site'), h('th', { class: 'right' }, 'Preço'), h('th', {}, 'Status'), h('th', {}))),
          h('tbody', {}, catalog.extras.map(e => h('tr', { class: e.active ? '' : 'is-off' },
            h('td', {}, h('strong', {}, e.name)), h('td', { class: 'muted' }, e.label), h('td', { class: 'right num' }, h('span', { class: 'price' }, money(e.price))),
            h('td', {}, e.active ? h('span', { class: 'pill pill--ok' }, 'Ativo') : h('span', { class: 'pill' }, 'Inativo')),
            h('td', { class: 'right' }, editable ? btn('', { icon: 'pencil', kind: 'ghost', size: 'sm', title: 'Editar', onclick: () => extraForm(e, draw) }) : '')))))));
    }

    function draw() {
      tabs.replaceChildren(...[['products', 'Produtos', catalog.products.length, 'utensils'], ['extras', 'Adicionais', catalog.extras.length, 'plus']].map(([id, label, n, i]) =>
        h('button', { class: tab === id ? 'is-active' : '', onclick: () => { tab = id; draw(); } }, icon(i, { size: 15 }), label, h('span', { class: 'count' }, String(n)))));
      chips.hidden = search.hidden = tab !== 'products';
      chips.replaceChildren(...[['all', 'Todos'], ...CATEGORIES].map(([id, label]) =>
        h('button', { class: `chip ${category === id ? 'is-active' : ''}`, onclick: () => { category = id; draw(); } }, label)));
      if (tab === 'products') drawProducts();
      else drawExtras();
    }

    body.append(h('div', { class: 'card' }, skeleton(8)));
    get('/api/admin/catalog').then(data => { catalog = data; draw(); })
      .catch(err => body.replaceChildren(h('div', { class: 'card' }, emptyState('Não foi possível carregar', err.message, 'wifiOff'))));
  },
};
