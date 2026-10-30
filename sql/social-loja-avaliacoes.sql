-- Frente B: avaliação de visita e de pedidos. Idempotente.
CREATE TABLE IF NOT EXISTS visit_reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "visitId" uuid NOT NULL REFERENCES store_visits(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment character varying(1000),
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_visit_reviews_visit" ON visit_reviews ("visitId");
CREATE INDEX IF NOT EXISTS "IDX_visit_reviews_createdAt" ON visit_reviews ("createdAt");

CREATE TABLE IF NOT EXISTS order_reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "orderId" uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_order_reviews_order" ON order_reviews ("orderId");
