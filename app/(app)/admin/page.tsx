import { redirect } from "next/navigation";

// /admin lands on People — the default tab. Splitting into per-tab routes
// (instead of one page with internal state) keeps each admin surface
// individually addressable / bookmarkable and lets the layout handle the
// role gate once for the whole tree.

export default function AdminIndexPage() {
  redirect("/admin/people");
}
