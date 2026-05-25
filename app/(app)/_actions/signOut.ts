"use server";

import { signOut } from "@/auth";

// Server action consumed by the Header sign-out form. Lives in the
// (app) route group so its proximity to the only caller is obvious; the
// generic Auth.js `signOut` is wrapped only to bake in `redirectTo` so
// the button is one-click.

export async function signOutAction() {
  await signOut({ redirectTo: "/signin" });
}
