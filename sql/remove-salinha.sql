-- Remove a funcionalidade de Salinha/Rooms. DESTRUTIVO: faça backup antes.
-- event_space_enum mantém 'SALINHA' porque eventos antigos ainda usam esse valor.
BEGIN;
DROP TABLE IF EXISTS salinha_reservations CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TYPE IF EXISTS rooms_reservationstatus_enum;
DROP TYPE IF EXISTS rooms_type_enum;
COMMIT;
