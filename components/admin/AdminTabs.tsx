"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";

// Tab nav rendered at the top of every /admin/* page. People + Contracts
// are visible to Admin + Manager; Access (allowlist + role assignment) is
// Manager-only, mirroring the procedure ladder enforced in tRPC.
// usePathname keeps the active-tab styling in sync with the URL on
// client-side navigation without a full reload.

type AdminTabsProps = {
  role: Role;
};

export function AdminTabs({ role }: AdminTabsProps) {
  const pathname = usePathname();

  const tabs: { href: string; label: string }[] = [
    { href: "/admin/people", label: "People" },
    { href: "/admin/contracts", label: "Contracts" },
  ];
  if (role === "MANAGER") {
    tabs.push({ href: "/admin/access", label: "Access" });
  }

  return (
    <nav className="admin-tabs" aria-label="Admin sections">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`admin-tab${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
