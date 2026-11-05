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
