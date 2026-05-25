import type { ReactNode } from "react";
import { auth } from "@/auth";
import { AdminTabs } from "@/components/admin/AdminTabs";

// /admin shell. Server-gated: any signed-in user gets here past the
// proxy, but Employees hit a friendly 403 panel instead of the tabs.
// The per-page tRPC procedures (`adminProcedure` / `managerProcedure`)
// back-stop this at the API layer — the page guard is just for UX.

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const role = session?.user?.role;

  if (!role || role === "EMPLOYEE") {
    return (
      <section className="admin-page">
        <div className="admin-denied" role="alert">
          <h2>Not authorized</h2>
          <p>
            The Admin section is for Admin and Manager roles. If you should
            have access, ask your team lead to update your role from the
            Access page.
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
