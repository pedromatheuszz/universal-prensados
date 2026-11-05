# Sistema de pedidos

Pedidos feitos no site são gravados no banco **Neon (Postgres)** e aparecem no **painel da cozinha** em tempo real. O cliente recebe um link para acompanhar o status. O WhatsApp continua sendo usado: a mensagem agora leva o número do pedido e o link de acompanhamento. Se a API estiver fora do ar, o pedido segue só pelo WhatsApp, como antes.

| Endereço | Para quem | O que faz |
|---|---|---|
| `/painel/` | Equipe (login) | Quadro de pedidos com alerta sonoro e relatórios de vendas |
| `/pedido/?t=…` | Cliente | Acompanhamento do pedido (atualiza sozinho) |

## Configuração inicial (uma vez)

1. **Neon:** crie um projeto e copie a *Pooled connection string*.
2. **Variáveis no Netlify** (Site configuration → Environment variables):
   - `DATABASE_URL`: a string de conexão do Neon.
   - `SESSION_SECRET`: 32+ caracteres aleatórios. Para gerar:
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. **Tabelas:** crie um `.env.local` com o mesmo `DATABASE_URL` (veja `.env.example`) e rode:
   ```
   npm run db:migrate
   ```
4. **Usuários da equipe:** um por pessoa. A senha é pedida no terminal (mínimo 10 caracteres):
   ```
   npm run staff:add -- nome-da-pessoa
   ```
   Rodar de novo com o mesmo nome redefine a senha.

## Uso no dia a dia

- Deixe `/painel/` aberto no computador ou tablet da cozinha e clique em **Ativar som**. O navegador só toca som depois de um clique.
- Fluxo de status:
  - entrega: **Novo → Em preparo → Saiu para entrega → Entregue**
  - retirada: **Novo → Em preparo → Pronto para retirada → Retirado**
- Pedidos parados há mais de 25 minutos em "Novo" ou "Em preparo" ficam com contorno vermelho.
- Os relatórios usam o horário de Brasília e não contam pedidos cancelados.

## Desenvolvimento local

`npm run dev` já sobe a API junto com o site. Sem `DATABASE_URL`, ela usa um Postgres local em `.data/dev-db` com o usuário de teste definido no `.env.example`. Para zerar os dados locais, apague a pasta `.data/`.

## Segurança

- Preços, taxas e cupons são recalculados no servidor a partir do catálogo do CMS. O total enviado pelo navegador é ignorado.
- Senhas guardadas com scrypt. A sessão fica num cookie `HttpOnly`, `Secure` e `SameSite=Strict`, assinado com `SESSION_SECRET`, e vale 14 horas.
- Bloqueio após 10 logins errados em 15 minutos e após 8 pedidos do mesmo IP em 10 minutos.
- O link de acompanhamento usa um token aleatório e não mostra telefone nem endereço.
