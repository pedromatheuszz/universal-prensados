/**
 * Script to create product data files for Decap CMS
 */
import fs from 'fs';
import path from 'path';

const productsDir = 'public/data/products';

const products = [
  {
    "id": "dog_lino",
    "name": "5. Dog Lino (Frango)",
    "category": "salgados",
    "price": 13.50,
    "desc": "Pão prensado macio e crocante, milho, batata palha, catchup, maionese e salsicha de frango selecionada.",
    "image": "dog.jpg",
    "badge": "Frango",
    "hasExtras": true
  },
  {
    "id": "dog_linozao",
    "name": "6. Dog Linozão Especial",
    "category": "salgados",
    "price": 19.00,
    "desc": "Pão prensado, milho, batata palha, catchup, maionese, salsicha de frango, bacon crocante e calabresa.",
    "image": "dogzao.jpg",
    "badge": "Imperdível",
    "hasExtras": true
  },
  {
    "id": "cheese",
    "name": "Cheese Prensado",
    "category": "salgados",
    "price": 15.00,
    "desc": "Pão prensado, milho, batata palha, catchup, maionese, salsicha e camada dupla de queijo mussarela derretido.",
    "image": "dogzao.jpg",
    "badge": "🧀 Muito Queijo",
    "hasExtras": true
  },
  {
    "id": "chicken",
    "name": "7. Chicken Especial",
    "category": "especiais",
    "price": 17.00,
    "desc": "Pão prensado na hora, milho, batata palha, salsicha, frango desfiado artesanal suculento e maionese da casa.",
    "image": "chicken.jpg",
    "badge": "⭐ Favorito",
    "hasExtras": true
  },
  {
    "id": "chickao",
    "name": "8. Chickão Completo",
    "category": "especiais",
    "price": 20.50,
    "desc": "O campeão da chapa! Pão prensado, milho, batata palha, salsicha, frango desfiado, bacon em fatias e calabresa.",
    "image": "chickao.jpg",
    "badge": "🔥 Campeão",
    "hasExtras": true
  },
  {
    "id": "combo_chicken",
    "name": "Combo Chicken Completo",
    "category": "combos",
    "price": 30.50,
    "desc": "1 Chicken Grande + Porção de batata frita de 150g + 1 Refrigerante lata 350ml gelado.",
    "image": "combo_chicken.jpg",
    "badge": "📦 Combo Individual",
    "hasExtras": true
  },
  {
    "id": "combo_dogzao",
    "name": "Combo Dogzão Completo",
    "category": "combos",
    "price": 30.50,
    "desc": "1 Dogzão Grande bem recheado + Batata frita crocante de 150g + 1 Refrigerante lata geladinho.",
    "image": "combo_dogzao.jpg",
    "badge": "🔥 Top Vendas",
    "hasExtras": true
  },
  {
    "id": "combo_kids",
    "name": "Combo Kids",
    "category": "combos",
    "price": 20.50,
    "desc": "1 Dog pequeno + Batata frita de 100g + Suco ou refrigerante lata.",
    "image": "combo_kids.jpg",
    "badge": "👶 Para os Pequenos",
    "hasExtras": true
  },
  {
    "id": "combo_familia",
    "name": "Combo Família Universal",
    "category": "combos",
    "price": 109.90,
    "desc": "2 Dogs Duplos Grandes + 2 Dogzões Grandes + Batata frita 600g + 1 Coca-Cola 2L.",
    "image": "combo_familia.jpg",
    "badge": "👨‍👩‍👧‍👦 Para Toda Família",
    "hasExtras": true
  },
  {
    "id": "doce_sonho",
    "name": "Prensado Sonho de Valsa",
    "category": "doces",
    "price": 13.50,
    "desc": "Pão prensado quentinho com toque especial, creme de leite fresco e muito bombom Sonho de Valsa derretido.",
    "image": "doce_sonho.jpg",
    "badge": "Sobremesa",
    "hasExtras": false
  },
  {
    "id": "doce_ouro",
    "name": "Prensado Ouro Branco",
    "category": "doces",
    "price": 13.50,
    "desc": "Pão prensado douradinho com creme de leite suave e bombons Ouro Branco cremosos.",
    "image": "doce_ouro.jpg",
    "badge": "Delicioso",
    "hasExtras": false
  },
  {
    "id": "doce_kitkat",
    "name": "Prensado Kit Kat Crocante",
    "category": "doces",
    "price": 17.00,
    "desc": "Pão prensado crocante com creme de leite fresco e barras de chocolate Kit Kat que derretem na boca.",
    "image": "doce_kitkat.jpg",
    "badge": "🍫 Premium",
    "hasExtras": false
  },
  {
    "id": "refri_lata",
    "name": "Refrigerante Lata 350ml",
    "category": "bebidas",
    "price": 8.00,
    "desc": "Coca-Cola, Guaraná Antarctica, Fanta Laranja ou Sprite. Bem gelado!",
    "image": "refri_lata.jpg",
    "badge": "",
    "hasExtras": false
  },
  {
    "id": "refri_600",
    "name": "Refrigerante 600ml",
    "category": "bebidas",
    "price": 10.00,
    "desc": "Garrafa individual de 600ml estupidamente gelada.",
    "image": "refri_lata.jpg",
    "badge": "",
    "hasExtras": false
  },
  {
    "id": "refri_2l",
    "name": "Refrigerante 2 Litros",
    "category": "bebidas",
    "price": 20.00,
    "desc": "Ideal para compartilhar em família ou com a galera.",
    "image": "refri_2l.jpg",
    "badge": "",
    "hasExtras": false
  },
  {
    "id": "suco_polpa",
    "name": "Suco Natural de Polpa 500ml",
    "category": "bebidas",
    "price": 9.00,
    "desc": "Polpa de fruta natural batida na hora: Maracujá, Laranja, Abacaxi ou Morango.",
    "image": "suco.jpg",
    "badge": "Fruta Natural",
    "hasExtras": false
  },
  {
    "id": "chopp_pilsen",
    "name": "Chopp Pilsen Artesanal 400ml",
    "category": "bebidas",
    "price": 13.00,
    "desc": "Chopp Pilsen artesanal de Joinville, servido com colarinho perfeito e super gelado.",
    "image": "chopp.jpg",
    "badge": "🍺 Gelado",
    "hasExtras": false
  },
  {
    "id": "agua",
    "name": "Água Mineral 500ml",
    "category": "bebidas",
    "price": 4.50,
    "desc": "Água mineral natural gelada, com ou sem gás.",
    "image": "agua.jpg",
    "badge": "",
    "hasExtras": false
  }
];

// Ensure directory exists
if (!fs.existsSync(productsDir)) {
  fs.mkdirSync(productsDir, { recursive: true });
}

// Write each product file
products.forEach(product => {
  const filePath = path.join(productsDir, `${product.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(product, null, 2), 'utf8');
  console.log(`Created: ${filePath}`);
});

console.log(`\n✅ Created ${products.length} product data files in ${productsDir}`);