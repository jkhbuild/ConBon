-- Real-time sync: register the Blocker table against the existing
-- notify_conbon_event() trigger function (declared in
-- 20260524195157_realtime_notify_triggers/migration.sql). The function
-- already dispatches on TG_TABLE_NAME so no function body change is needed.
--
-- With this trigger, NOTIFY conbon_events fires for INSERT/UPDATE/DELETE
-- on Blocker; lib/realtime/listener.ts forwards to SSE; the client's
-- useRealtimeSync invalidates blockers.list so the CM column refreshes
-- within one round-trip of a raise / acknowledge / clear.

CREATE TRIGGER notify_blocker_change
  AFTER INSERT OR UPDATE OR DELETE ON "Blocker"
  FOR EACH ROW EXECUTE FUNCTION notify_conbon_event();
