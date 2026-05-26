"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/auth";

// Auth.js v5's `signOut({ redirectTo })` from a Server Action issues its
// own redirect, but when the action is wrapped in a Radix
// DropdownMenu.Item the menu's onSelect default behavior closes the
// portal and React unmounts the form before the redirect protocol
// completes — the browser sees nothing and the user stays on /active.
// Clearing the session cookie with `redirect: false` and then calling
// next/navigation's `redirect()` ourselves takes the navigation through
// React's own Server Action redirect protocol, which the router
// reliably honors regardless of the surrounding UI.

export async function signOutAction() {
  await signOut({ redirect: false });
  redirect("/signin");
}
