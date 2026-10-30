-- Frente B: chamado de monitor como item de pedido. Rode FORA de transação (ADD VALUE).
ALTER TYPE order_items_kind_enum ADD VALUE IF NOT EXISTS 'HELP';
