# Sistema de pedidos e gestão

O projeto tem três partes:

| Pasta | O que é | Para quem |
|---|---|---|
| `site/` | Site de pedidos (cardápio, carrinho, checkout, acompanhamento `/pedido/`) | Clientes |
| `app/` | **Universal Gestão**, um programa de Windows para administrar a loja | Donos e equipe |
| `server/`, `netlify/functions/`, `api/`, `db/` | API e banco **Neon (Postgres)**, usados pelo site e pelo app | — |
| `shared/` | Regras usadas pelos dois lados (preços, horários, imagens) | — |

O site e a API são publicados juntos na **Vercel** (o projeto também continua pronto para o Netlify). O app é instalado no computador da lanchonete e conversa com a API do site pela internet.

## O que o app de gestão faz

| Tela | O que faz | Quem acessa |
|---|---|---|
| Pedidos | Quadro em tempo real (Novos → Em preparo → Prontos/em entrega → Finalizados), som, notificação do Windows, impressão de comanda, cancelamento com motivo e histórico de quem mudou cada status | Todos |
| Histórico | Busca por período, nome, telefone, nº do pedido e status, com exportação em CSV | Dono, atendente |
| Cardápio | Preços, descrições, produtos novos, **esgotado** (some do carrinho na hora), ativar/desativar e adicionais | Todos veem; esgotado: todos; editar: dono |
| Loja e entrega | Pausar pedidos do site, horário de funcionamento (pode passar da meia-noite, ex.: 18:00 às 01:00), WhatsApp, chave Pix, frete grátis, bairros/taxas e cupons | Pausar: dono e atendente; editar: dono |
| Caixa | Abertura com troco, sangria/suprimento, vendas por forma de pagamento, fechamento com conferência do dinheiro | Dono, atendente |
| Financeiro | Resultado do mês (faturamento − despesas), lançamento de despesas por categoria e relatório de vendas | Dono |
| Equipe | Usuários, papéis (dono, atendente, cozinha), desativar acesso e registro de alterações | Dono |
| Ajustes | Impressora, papel 80/58 mm, impressão automática, som, tema, servidor e iniciar com o Windows | Cada computador |

Tudo o que é alterado no app vale **na hora** no site: preço, esgotado, pausa, horários, bairros, cupons, WhatsApp e chave Pix. O site busca esses dados em `/api/catalog` ao abrir e confere mudanças a cada 2 minutos. Se a API demorar (o banco gratuito do Neon "acorda" em alguns segundos), o site abre com a cópia feita no último build e se atualiza sozinho quando a resposta chega.

## Configuração inicial (uma vez)

1. **Neon:** crie um projeto e copie a *Pooled connection string*.
2. **Variáveis na Vercel** (Project → Settings → Environment Variables, marcando *Production* e *Preview*; no Netlify: Site configuration → Environment variables):
   - `DATABASE_URL`: a string de conexão do Neon.
   - `SESSION_SECRET`: 32+ caracteres aleatórios. Para gerar:
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. **Tabelas e cardápio inicial:** crie um `.env.local` com o mesmo `DATABASE_URL` (veja `.env.example`) e rode:
   ```
   npm run db:migrate
   ```
   Na primeira vez, o cardápio, os bairros, os cupons e os horários são copiados de `db/seed/`. Depois disso, quem manda é o app (rodar de novo não sobrescreve nada).
4. **Primeiro dono:** a senha é pedida no terminal (mínimo 10 caracteres):
   ```
   npm run staff:add -- nome-do-dono
   ```
   Os outros usuários são criados pelo próprio app, na tela **Equipe**.
5. **Publicar o site:** veja [Publicar na Vercel](#publicar-na-vercel).
6. **Instalar o app:** gere o instalador com `npm run app:dist` (sai em `app/dist/`) e rode-o no computador da lanchonete. Na tela de login, confira o servidor (padrão `https://universalprensados.com.br`).

## Publicar na Vercel

Tudo já está configurado em `vercel.json`: build (`npm run build`), pasta publicada (`site/dist`), a API em `/api/*`, cabeçalhos de segurança (CSP, HSTS) e cache. A função roda em São Paulo (`gru1`), na mesma região do banco Neon.

1. Na Vercel, **Add New › Project** e importe o repositório `pedromatheuszz/universal-prensados` do GitHub.
2. Em *Framework Preset* deixe **Other**. Não mude build, pasta de saída nem install: o `vercel.json` já define.
3. Em *Environment Variables*, cadastre `DATABASE_URL` e `SESSION_SECRET` (os mesmos do `.env.local`). Elas precisam existir também no build, para o site sair com o cardápio atual.
4. **Deploy.** Depois, em *Settings › Domains*, ligue o domínio `universalprensados.com.br` (a Vercel mostra os registros DNS a criar).
5. Teste `https://<seu-endereço>/api/catalog` (deve responder com o cardápio) e faça login no app apontando para esse endereço.

Cada `git push` na `main` publica uma nova versão automaticamente.

Como funciona: a Vercel não usa as rotas de cada arquivo de `netlify/functions/`. O `vercel.json` manda todo `/api/*` para uma função só, `api/router.js`, que escolhe a função certa pela tabela de `server/routes.js`. As funções são as mesmas nas duas hospedagens. **Ao criar uma função nova em `netlify/functions/`, inclua-a também em `server/routes.js`.**

O `/admin` (Decap CMS) depende do Netlify Identity e **não funciona na Vercel**. Na Vercel, os textos do site são editados direto no repositório.

## Instalar e atualizar o app

O app é distribuído pelo instalador `.exe`, sem assinatura digital.

**Instalar**
1. Gere o instalador: `npm run app:dist` (sai em `app/dist/Universal Gestão Setup <versão>.exe`).
2. Leve o arquivo ao computador da lanchonete (pen drive, Google Drive etc.) e abra.
3. Como o instalador não é assinado, o Windows mostra "O Windows protegeu o computador". Clique em **Mais informações** › **Executar assim mesmo**. Isso só acontece na instalação.
4. Na tela de login, confira o endereço do servidor (link "alterar servidor").

**Atualizar**
1. Aumente `version` em `app/package.json` (ex.: 1.0.0 → 1.0.1) e gere o instalador de novo.
2. Rode o instalador novo no computador da lanchonete, por cima do antigo. As configurações (impressora, som, servidor) são mantidas; pode ser preciso entrar de novo com usuário e senha.

## Desenvolvimento local

```
npm install
npm run dev            # site + API em http://localhost:3000 (banco local PGlite em .data/)
npm run app:install    # uma vez: dependências do app (Electron)
npm --prefix app run dev   # abre o app já apontando para http://localhost:3000
```

Sem `DATABASE_URL`, a API usa um Postgres local em `.data/dev-db` com o usuário de teste do `.env.example` (papel dono). Para zerar os dados locais, apague a pasta `.data/`.

Na primeira instalação, o npm pode pedir autorização para os scripts de instalação do Electron. Eles já estão liberados em `app/package.json` (`allowScripts`).

## Fluxo dos pedidos

- Entrega: **Novo → Em preparo → Saiu para entrega → Entregue**
- Retirada: **Novo → Em preparo → Pronto para retirada → Retirado**
- Pedidos parados há mais de 25 minutos em "Novo" ou "Em preparo" ficam com contorno vermelho.
- Cancelar exige um motivo, que fica gravado no pedido.
- O WhatsApp continua sendo usado: a mensagem leva o número do pedido e o link de acompanhamento. Se a API estiver fora do ar, o pedido segue só pelo WhatsApp.
- Com a loja fechada (fora do horário) ou pausada, o site não aceita pedidos, e a API também recusa.
- Nada é descartado em silêncio: cupom que deixou de valer, adicional removido do cardápio, mais de 40 itens diferentes ou mais de 99 unidades de um item fazem a API recusar o pedido com uma mensagem clara.
- Se a conexão do app cair por mais de 1 minuto, ele avisa com uma notificação do Windows, porque os pedidos novos param de chegar.

## Segurança

- Preços, taxas, cupons, esgotado e horário são conferidos no servidor a partir do banco. O total enviado pelo navegador é ignorado.
- Senhas guardadas com scrypt. O app recebe um token assinado com `SESSION_SECRET` (vale 14 horas e é renovado a cada 30 minutos enquanto o app está aberto), guardado criptografado pelo Windows quando "Manter conectado" está marcado.
- O login responde igual para usuário inexistente e senha errada, inclusive no tempo de resposta, para não revelar quais usuários existem.
- A lista de cupons não é pública: o site confere só o código digitado (`/api/coupons/:código`).
- O registro de alterações guarda só campos conhecidos (nunca senhas).
- O app desktop roda isolado (sem Node na interface, `sandbox`, CSP própria), só fala com `/api/admin/*` do servidor configurado, só abre links do WhatsApp e do próprio site, e o instalador vem com os *fuses* do Electron travados (sem modo Node e só carrega o código empacotado).
- O CSV exportado no Histórico neutraliza fórmulas digitadas por clientes (proteção contra *CSV injection* no Excel).
- A cada requisição a API confere se o usuário continua ativo e com o mesmo papel. Desativar alguém ou trocar a senha derruba a sessão na hora.
- Cada papel só acessa o que precisa (ver tabela acima). As permissões são checadas no servidor, não só escondidas na tela.
- Bloqueio após 10 logins errados em 15 minutos e após 8 pedidos do mesmo IP em 10 minutos.
- O link de acompanhamento usa um token aleatório e não mostra telefone nem endereço.
- O `/admin` (Decap CMS) agora só edita textos do site (endereço, depoimentos, banners). Cardápio e preços ficam no app.
