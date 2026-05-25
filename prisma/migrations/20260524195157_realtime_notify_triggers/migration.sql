-- Real-time sync: pg_notify trigger for client invalidation.
--
-- Phase 8. A long-lived pg.Client in lib/realtime/listener.ts holds a
-- `LISTEN conbon_events` connection per Node process and fans out to
-- SSE subscribers (app/api/events/route.ts); the client side invalidates
-- the matching React Query key.
--
-- Payload shape is intentionally tiny — table name + op + row id — well
-- under the 8000-byte pg_notify atomic guarantee. The row body is never
-- serialized through NOTIFY; clients re-fetch the affected list via tRPC.

CREATE OR REPLACE FUNCTION notify_conbon_event() RETURNS trigger AS $$
DECLARE
  row_id text;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    row_id := OLD.id;
  ELSE
    row_id := NEW.id;
  END IF;

  PERFORM pg_notify(
    'conbon_events',
    jsonb_build_object(
      'type', TG_TABLE_NAME,
      'op',   TG_OP,
      'id',   row_id
    )::text
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_card_change
  AFTER INSERT OR UPDATE OR DELETE ON "Card"
  FOR EACH ROW EXECUTE FUNCTION notify_conbon_event();

CREATE TRIGGER notify_person_change
  AFTER INSERT OR UPDATE OR DELETE ON "Person"
  FOR EACH ROW EXECUTE FUNCTION notify_conbon_event();

CREATE TRIGGER notify_contract_change
  AFTER INSERT OR UPDATE OR DELETE ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION notify_conbon_event();
