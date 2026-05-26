import { getServerCaller } from "@/lib/trpc/server";
import { ContractsAdmin } from "@/components/admin/ContractsAdmin";

// /admin/contracts — Admin (or Commercial Manager) only. The parent
// layout.tsx already gates bottom-tier roles; this RSC fetches the
// listAll payload and hands off to the client component.

export const dynamic = "force-dynamic";

export default async function ContractsAdminPage() {
  const trpc = await getServerCaller();
  const contracts = await trpc.contracts.listAll();
  return <ContractsAdmin initialContracts={contracts} />;
}
