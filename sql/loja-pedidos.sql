-- Frente 2: cardápio, comandas e pedidos da loja. Idempotente.
DO $$ BEGIN
  CREATE TYPE menu_items_category_enum AS ENUM ('FOOD', 'DRINK', 'DESSERT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE order_tabs_status_enum AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE orders_status_enum AS ENUM ('PENDING', 'PREPARING', 'DONE', 'CANCELED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE order_items_kind_enum AS ENUM ('MENU', 'GAME');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  description text,
  category menu_items_category_enum NOT NULL DEFAULT 'FOOD',
  price numeric(10,2) NOT NULL DEFAULT 0,
  "imageUrl" character varying,
  available boolean NOT NULL DEFAULT true,
  "dailySpecial" boolean NOT NULL DEFAULT false,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_tabs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "customerName" character varying(80) NOT NULL,
  "cardNumber" character varying(20) NOT NULL,
  "visitId" uuid,
  status order_tabs_status_enum NOT NULL DEFAULT 'OPEN',
  "openedAt" timestamp NOT NULL DEFAULT now(),
  "closedAt" timestamp,
  "closedById" uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_order_tabs_open_user" ON order_tabs ("userId") WHERE "status" = 'OPEN';
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_order_tabs_open_card" ON order_tabs ("cardNumber") WHERE "status" = 'OPEN';

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tabId" uuid NOT NULL REFERENCES order_tabs(id) ON DELETE CASCADE,
  status orders_status_enum NOT NULL DEFAULT 'PENDING',
  "tableLabel" character varying(30),
  note text,
  "handledById" uuid,
  "doneAt" timestamp,
  "canceledReason" character varying(200),
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_orders_tabId" ON orders ("tabId");
CREATE INDEX IF NOT EXISTS "IDX_orders_status_createdAt" ON orders (status, "createdAt");

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "orderId" uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind order_items_kind_enum NOT NULL,
  "menuItemId" uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  "gameId" uuid REFERENCES games(id) ON DELETE SET NULL,
  "nameSnapshot" character varying NOT NULL,
  "unitPrice" numeric(10,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  note character varying(200)
);
