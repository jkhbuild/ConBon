"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useOptimisticListMutation } from "@/lib/hooks/useOptimisticListMutation";
import type { RouterOutputs } from "@/lib/trpc/types";
import type { Role } from "@prisma/client";
import { DataTable } from "./DataTable";

type Row = RouterOutputs["allowedUsers"]["list"][number];

type Props = {
  initialRows: Row[];
  viewerEmail: string | null;
};

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "ANALYST", label: "Analyst" },
  { value: "ESTIMATOR", label: "Estimator" },
  { value: "SCHEDULER", label: "Scheduler" },
  { value: "COMMERCIAL_MANAGER", label: "Commercial Manager" },
  { value: "ADMIN", label: "Admin" },
];

const ROLE_LABEL: Record<Role, string> = {
  ANALYST: "Analyst",
  ESTIMATOR: "Estimator",
  SCHEDULER: "Scheduler",
  COMMERCIAL_MANAGER: "Commercial Manager",
  ADMIN: "Admin",
};

const ROLE_CLASS: Record<Role, string> = {
  ANALYST: "is-analyst",
  ESTIMATOR: "is-estimator",
  SCHEDULER: "is-scheduler",
  COMMERCIAL_MANAGER: "is-commercial-manager",
  ADMIN: "is-admin",
};

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function AccessAdmin({ initialRows, viewerEmail }: Props) {
  const utils = trpc.useUtils();
  const { data: rows = initialRows } = trpc.allowedUsers.list.useQuery(
    undefined,
    { initialData: initialRows },
  );

  const [draftEmail, setDraftEmail] = useState("");
  const [draftRole, setDraftRole] = useState<Role>("ANALYST");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const addMutation = trpc.allowedUsers.add.useMutation({
    onSettled: () => {
      void utils.allowedUsers.list.invalidate();
    },
    onSuccess: () => {
      setDraftEmail("");
      setDraftRole("ANALYST");
      setErrorMessage(null);
    },
    onError: (err) => {
      setErrorMessage(
        err.message.includes("Unique constraint") ||
          err.data?.code === "CONFLICT"
          ? "That email is already on the allowlist."
          : err.message,
      );
    },
  });

  const removeMutation = trpc.allowedUsers.remove.useMutation({
    ...useOptimisticListMutation<{ id: string }, Row>(
      utils.allowedUsers.list,
      (old, input) => old.filter((r) => r.id !== input.id),
    ),
    onSettled: () => {
      void utils.allowedUsers.list.invalidate();
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const email = draftEmail.trim();
    if (!email) return;
    addMutation.mutate({ email, role: draftRole });
  };

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Access</h1>
          <p className="admin-sub">
            {rows.length} {rows.length === 1 ? "email" : "emails"} on the
            allowlist. Only listed emails can sign in. Removing someone
            doesn&rsquo;t invalidate their active session &mdash; pair with a
            People deactivate to revoke immediately. Role changes apply on
            the user&rsquo;s next sign-in.
          </p>
        </div>
      </div>

      <form className="inline-add" onSubmit={handleAdd}>
        <div className="field">
          <label className="field-label" htmlFor="allow-email">
            Email
          </label>
          <input
            id="allow-email"
            type="email"
            value={draftEmail}
            onChange={(e) => setDraftEmail(e.target.value)}
            placeholder="name@example.com"
            required
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="allow-role">
            Role
          </label>
          <select
            id="allow-role"
            value={draftRole}
            onChange={(e) => setDraftRole(e.target.value as Role)}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="btn-primary"
          disabled={addMutation.isPending || draftEmail.trim().length === 0}
        >
          {addMutation.isPending ? "Adding…" : "Add to allowlist"}
        </button>
      </form>
      {errorMessage && (
        <p className="field-error" role="alert">
          {errorMessage}
        </p>
      )}

      <DataTable.Root>
        <DataTable.Head>
          <DataTable.HeaderCell>Email</DataTable.HeaderCell>
          <DataTable.HeaderCell width="130px">Role</DataTable.HeaderCell>
          <DataTable.HeaderCell width="160px">Added by</DataTable.HeaderCell>
          <DataTable.HeaderCell width="140px">Added</DataTable.HeaderCell>
          <DataTable.HeaderCell width="120px" align="right">
            Actions
          </DataTable.HeaderCell>
        </DataTable.Head>
        <DataTable.Body>
          {rows.map((row) => {
            const isSelf = viewerEmail !== null && row.email === viewerEmail;
            return (
              <DataTable.Row key={row.id}>
                <DataTable.Cell>{row.email}</DataTable.Cell>
                <DataTable.Cell>
                  <span className={`role-pill ${ROLE_CLASS[row.role]}`}>
                    <span className="role-pill-tag">{ROLE_LABEL[row.role]}</span>
                  </span>
                </DataTable.Cell>
                <DataTable.Cell>
                  {row.addedBy?.name ?? row.addedBy?.email ?? "—"}
                </DataTable.Cell>
                <DataTable.Cell>{DATE_FMT.format(row.createdAt)}</DataTable.Cell>
                <DataTable.Cell align="right">
                  <button
                    type="button"
                    className="btn-row is-danger"
                    onClick={() => removeMutation.mutate({ id: row.id })}
                    disabled={isSelf || removeMutation.isPending}
                    title={
                      isSelf
                        ? "You can't remove your own allowlist entry"
                        : "Remove from allowlist"
                    }
                  >
                    Remove
                  </button>
                </DataTable.Cell>
              </DataTable.Row>
            );
          })}
        </DataTable.Body>
      </DataTable.Root>
      {rows.length === 0 && (
        <DataTable.Empty>
          Allowlist is empty. Add an email above to enable sign-in.
        </DataTable.Empty>
      )}
    </>
  );
}
