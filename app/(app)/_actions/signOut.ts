"use server";

import { signOut } from "@/auth";

// Called from a client onSelect handler in components/shell/Header.tsx.
// The client handler navigates with router.push after this resolves; we
// don't redirect from the server action because the Radix
// DropdownMenu.Item that wraps the trigger unmounts on its onSelect
// (synchronously, on click) before React's SA-redirect protocol can
// resolve, and the redirect is silently lost — even when the SA uses
// next/navigation's redirect() (PR #21's attempted fix). Doing the
// navigation client-side after the action returns decouples it from
// the form-mount lifetime.

export async function signOutAction() {
  await signOut({ redirect: false });
}
