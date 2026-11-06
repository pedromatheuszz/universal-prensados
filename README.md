# Universal Prensados

Site de pedidos da Universal Prensados (Joinville/SC) e **Universal Gestão**, o app de Windows que os donos usam para administrar a lanchonete.

| Pasta | O que é |
|---|---|
| `site/` | Site dos clientes: cardápio, carrinho, checkout e acompanhamento do pedido (`/pedido/`). Vite + JavaScript puro + GSAP |
| `app/` | App de gestão para Windows (Electron): pedidos em tempo real, histórico, cardápio, loja e entrega, caixa, financeiro e equipe |
| `server/`, `netlify/functions/`, `api/` | API usada pelo site e pelo app. Na Vercel, tudo passa por `api/router.js` (rotas em `server/routes.js`); o Netlify usa cada arquivo de `netlify/functions/` direto |
| `db/` | Schema do banco (Neon/Postgres) e dados iniciais (`db/seed/`) |
| `shared/` | Regras usadas pelos dois lados: preços, horário de funcionamento, imagens |
| `tests/` | Testes unitários, da API (Postgres em memória) e e2e do site (Playwright) |

## Comandos

```bash
npm install                 # dependências do site e da API
npm run dev                 # site + API em http://localhost:3000
npm test                    # testes unitários e da API
npm run test:e2e            # testes do site no navegador
npm run lint
npm run build               # gera site/dist (publicado pela Vercel ou Netlify)

npm run app:install         # dependências do app (uma vez)
npm --prefix app run dev    # abre o app apontando para http://localhost:3000
npm run app:dist            # gera o instalador em app/dist/

npm run db:migrate          # cria/atualiza as tabelas no Neon (DATABASE_URL no .env.local)
npm run staff:add -- nome   # cria o primeiro dono
```

Sem `DATABASE_URL`, o `npm run dev` usa um Postgres local de teste em `.data/`. Com `DATABASE_URL` no `.env.local`, ele usa o banco real.

## Documentação

- [Sistema de pedidos e gestão](docs/sistema-de-pedidos.md): configuração do Neon, publicação na Vercel, papéis da equipe, fluxo dos pedidos e segurança.
