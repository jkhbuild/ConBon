import { auth } from "@/auth";
import { getServerCaller } from "@/lib/trpc/server";
import { PeopleAdmin } from "@/components/admin/PeopleAdmin";

// /admin/people — Admin (or Commercial Manager) only. The parent
// admin/layout.tsx already gates bottom-tier roles; this RSC fetches the
// listAll payload and the viewer role so the client component can
// conditionally render the role select (Admin-only).

export const dynamic = "force-dynamic";

export default async function PeopleAdminPage() {
  const trpc = await getServerCaller();
  const session = await auth();
  const [people] = await Promise.all([trpc.people.listAll()]);
  return (
    <PeopleAdmin
      initialPeople={people}
      viewerRole={session?.user?.role ?? "ANALYST"}
    />
  );
}
