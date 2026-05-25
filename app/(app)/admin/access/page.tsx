import { auth } from "@/auth";
import { getServerCaller } from "@/lib/trpc/server";
import { AccessAdmin } from "@/components/admin/AccessAdmin";

// /admin/access — Manager-only. Admin tier sees a friendly 403 message;
// allowedUsers.list itself is `managerProcedure` so a hand-crafted
// request would 403 at the API too. Pass viewerEmail so the UI can
// disable self-remove (foot-gun: a Manager removing themselves would
// lock themselves out at next sign-in).

export const dynamic = "force-dynamic";

export default async function AccessAdminPage() {
  const session = await auth();
  const role = session?.user?.role;
  const viewerEmail = session?.user?.email?.toLowerCase() ?? null;

  if (role !== "MANAGER") {
    return (
      <div className="admin-denied" role="alert">
        <h2>Manager only</h2>
        <p>
          The Access section manages the sign-in allowlist and role
          assignments. Only the Manager tier can view or edit it.
        </p>
      </div>
    );
  }

  const trpc = await getServerCaller();
  const rows = await trpc.allowedUsers.list();
  return <AccessAdmin initialRows={rows} viewerEmail={viewerEmail} />;
}
