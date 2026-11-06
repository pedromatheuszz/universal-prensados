# Sistema de pedidos e gestão

O projeto tem três partes:

| Pasta | O que é | Para quem |
|---|---|---|
| `site/` | Site de pedidos (cardápio, carrinho, checkout, acompanhamento `/pedido/`) | Clientes |
| `app/` | **Universal Gestão**, um programa de Windows para administrar a loja | Donos e equipe |
| `server/`, `netlify/functions/`, `db/` | API e banco **Neon (Postgres)**, usados pelo site e pelo app | — |
| `shared/` | Regras usadas pelos dois lados (preços, horários, imagens) | — |

O site e a API são publicados juntos no Netlify. O app é instalado no computador da lanchonete e conversa com a API do site pela internet.

## O que o app de gestão faz

| Tela | O que faz | Quem acessa |
|---|---|---|
| Pedidos | Quadro em tempo real (Novos → Em preparo → Prontos/em entrega → Finalizados), som, notificação do Windows, impressão de comanda, cancelamento com motivo e histórico de quem mudou cada status | Todos |
| Histórico | Busca por período, nome, telefone, nº do pedido e status, com exportação em CSV | Dono, atendente |
| Cardápio | Preços, descrições, produtos novos, **esgotado** (some do carrinho na hora), ativar/desativar e adicionais | Todos veem; esgotado: todos; editar: dono |
| Loja e entrega | Pausar pedidos do site, horário de funcionamento, WhatsApp, frete grátis, bairros/taxas e cupons | Pausar: dono e atendente; editar: dono |
| Caixa | Abertura com troco, sangria/suprimento, vendas por forma de pagamento, fechamento com conferência do dinheiro | Dono, atendente |
| Financeiro | Resultado do mês (faturamento − despesas), lançamento de despesas por categoria e relatório de vendas | Dono |
| Equipe | Usuários, papéis (dono, atendente, cozinha), desativar acesso e registro de alterações | Dono |
| Ajustes | Impressora, papel 80/58 mm, impressão automática, som, tema, servidor e iniciar com o Windows | Cada computador |

Tudo o que é alterado no app vale **na hora** no site: preço, esgotado, pausa, horários, bairros e cupons. O site busca esses dados em `/api/catalog`. Se a API estiver fora do ar, ele usa a cópia feita no último build.

## Configuração inicial (uma vez)

1. **Neon:** crie um projeto e copie a *Pooled connection string*.
2. **Variáveis no Netlify** (Site configuration → Environment variables):
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
5. **Instalar o app:** gere o instalador com `npm run app:dist` (sai em `app/dist/`) e rode-o no computador da lanchonete. Na tela de login, confira o servidor (padrão `https://universalprensados.com.br`).

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

## Segurança

- Preços, taxas, cupons, esgotado e horário são conferidos no servidor a partir do banco. O total enviado pelo navegador é ignorado.
- Senhas guardadas com scrypt. O app recebe um token assinado com `SESSION_SECRET` (vale 14 horas), guardado criptografado pelo Windows quando "Manter conectado" está marcado.
- A cada requisição a API confere se o usuário continua ativo e com o mesmo papel. Desativar alguém ou trocar a senha derruba a sessão na hora.
- Cada papel só acessa o que precisa (ver tabela acima). As permissões são checadas no servidor, não só escondidas na tela.
- Bloqueio após 10 logins errados em 15 minutos e após 8 pedidos do mesmo IP em 10 minutos.
- O link de acompanhamento usa um token aleatório e não mostra telefone nem endereço.
- O `/admin` (Decap CMS) agora só edita textos do site (endereço, depoimentos, banners). Cardápio e preços ficam no app.
