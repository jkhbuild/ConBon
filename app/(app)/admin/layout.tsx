import type { ReactNode } from "react";
import { auth } from "@/auth";
import { AdminTabs } from "@/components/admin/AdminTabs";

// /admin shell. Server-gated: any signed-in user gets here past the
// proxy, but only Admin viewers see the tabs; everyone else (Commercial
// Manager + the three bottom-tier roles) hits a friendly 403 panel.
// Matches the post-v1 nav-dropdown intent that the Admin section is
// reserved for the single Admin user; deep-linking from any other role
// lands on the denial copy. The tRPC procedures (`commercialManagerProcedure`
// / `adminProcedure`) still accept Commercial Manager for the CRUD
// mutations as defense in depth — nothing on this layout reaches those
// paths now that the UI gate is closed.

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";

  if (!isAdmin) {
    return (
      <section className="admin-page">
        <div className="admin-denied" role="alert">
          <h2>Not authorized</h2>
          <p>
            The Admin section is reserved for the Admin role. If you
            should have access, ask the team Admin to update your role
            from the Access page.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <AdminTabs role={role} />
      {children}
    </section>
  );
}
