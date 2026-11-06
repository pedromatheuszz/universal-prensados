-- Esquema do sistema de pedidos (Neon / Postgres). Idempotente: pode rodar várias vezes.
-- Aplicar com: npm run db:migrate

CREATE TABLE IF NOT EXISTS orders (
  id              BIGSERIAL PRIMARY KEY,
  tracking_token  TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'novo'
                  CHECK (status IN ('novo', 'preparando', 'pronto', 'saiu_entrega', 'entregue', 'cancelado')),
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  delivery_type   TEXT NOT NULL CHECK (delivery_type IN ('delivery', 'pickup')),
  address         JSONB,
  district        TEXT,
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('pix', 'cartao', 'dinheiro')),
  change_for      TEXT,
  items           JSONB NOT NULL,
  subtotal        NUMERIC(10, 2) NOT NULL,
  discount        NUMERIC(10, 2) NOT NULL DEFAULT 0,
  delivery_fee    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total           NUMERIC(10, 2) NOT NULL,
  coupon_code     TEXT,
  client_ip_hash  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_ip_recent_idx ON orders (client_ip_hash, created_at);

CREATE TABLE IF NOT EXISTS order_status_history (
  id          BIGSERIAL PRIMARY KEY,
  order_id    BIGINT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  changed_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_status_history_order_idx ON order_status_history (order_id, created_at);

CREATE TABLE IF NOT EXISTS staff_users (
  id             BIGSERIAL PRIMARY KEY,
  username       TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id          BIGSERIAL PRIMARY KEY,
  ip_hash     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempts_ip_idx ON login_attempts (ip_hash, created_at);

-- ---------------------------------------------------------------------------
-- Gestão (app de desktop): equipe com papéis, cardápio, loja, caixa e finanças.
-- Os dados iniciais vêm de db/seed/ (aplicados só quando as tabelas estão vazias).
-- ---------------------------------------------------------------------------

-- role: dono | atendente | cozinha. session_version invalida sessões ao trocar senha ou desativar.
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'dono';
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 1;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
CREATE INDEX IF NOT EXISTS orders_customer_phone_idx ON orders (customer_phone);

CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,
  price        NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  description  TEXT NOT NULL DEFAULT '',
  image        TEXT NOT NULL DEFAULT '',
  badge        TEXT NOT NULL DEFAULT '',
  has_extras   BOOLEAN NOT NULL DEFAULT true,
  active       BOOLEAN NOT NULL DEFAULT true,
  sold_out     BOOLEAN NOT NULL DEFAULT false,
  sort_order   INT NOT NULL DEFAULT 9999,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS extras (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL DEFAULT '',
  price       NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  active      BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS districts (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL DEFAULT '',
  fee         NUMERIC(10, 2) NOT NULL CHECK (fee >= 0),
  active      BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS coupons (
  code              TEXT PRIMARY KEY,
  discount_percent  NUMERIC(5, 2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  description       TEXT NOT NULL DEFAULT '',
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Configurações da loja (nome, WhatsApp, frete grátis, horários, pausa...) como chave → JSON
CREATE TABLE IF NOT EXISTS store_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT
);

CREATE TABLE IF NOT EXISTS cash_sessions (
  id               BIGSERIAL PRIMARY KEY,
  opened_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_by        TEXT NOT NULL,
  opening_amount   NUMERIC(10, 2) NOT NULL CHECK (opening_amount >= 0),
  closed_at        TIMESTAMPTZ,
  closed_by        TEXT,
  expected_amount  NUMERIC(10, 2),
  counted_amount   NUMERIC(10, 2),
  notes            TEXT NOT NULL DEFAULT ''
);

-- No máximo um caixa aberto por vez
CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_single_open_idx ON cash_sessions ((closed_at IS NULL)) WHERE closed_at IS NULL;

CREATE TABLE IF NOT EXISTS cash_movements (
  id           BIGSERIAL PRIMARY KEY,
  session_id   BIGINT NOT NULL REFERENCES cash_sessions (id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('sangria', 'suprimento')),
  amount       NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  description  TEXT NOT NULL DEFAULT '',
  created_by   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cash_movements_session_idx ON cash_movements (session_id, created_at);

CREATE TABLE IF NOT EXISTS expenses (
  id           BIGSERIAL PRIMARY KEY,
  spent_on     DATE NOT NULL,
  category     TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  amount       NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  created_by   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_spent_on_idx ON expenses (spent_on);

-- Quem alterou o quê (cardápio, loja, caixa, equipe)
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  username    TEXT NOT NULL,
  action      TEXT NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);
