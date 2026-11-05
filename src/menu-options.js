// Adicionais e remoções do modal de personalização.
// Fonte única: o site monta os checkboxes daqui e o servidor (netlify/functions) usa os mesmos preços.

export const EXTRAS = [
  { id: 'bacon', name: 'Bacon Crocante', label: '+ Bacon Crocante Extra', price: 3.5 },
  { id: 'queijo', name: 'Queijo Duplo', label: '+ Queijo Mussarela Duplo', price: 3 },
  { id: 'catupiry', name: 'Catupiry', label: '+ Catupiry Original', price: 3.5 },
  { id: 'salsicha', name: 'Salsicha Extra', label: '+ Salsicha Extra', price: 2.5 },
  { id: 'batata', name: 'Batata Palha Extra', label: '+ Batata Palha Extra', price: 2 },
  { id: 'ovo', name: 'Ovo na Chapa', label: '+ Ovo na Chapa', price: 2.5 },
];

export const REMOVALS = ['Sem milho', 'Sem batata palha', 'Sem maionese', 'Sem catchup'];

export const EXTRAS_BY_NAME = new Map(EXTRAS.map(e => [e.name, { name: e.name, price: e.price }]));
