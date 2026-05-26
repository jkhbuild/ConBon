"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useOptimisticListMutation } from "@/lib/hooks/useOptimisticListMutation";
import type { RouterOutputs } from "@/lib/trpc/types";
import type { Role } from "@prisma/client";
import { DataTable } from "./DataTable";
import { PersonEditModal } from "./PersonEditModal";

type Person = RouterOutputs["people"]["listAll"][number];

type Props = {
  initialPeople: Person[];
  viewerRole: Role;
};

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; person: Person };

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

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0]!)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PeopleAdmin({ initialPeople, viewerRole }: Props) {
  const utils = trpc.useUtils();
  const { data: people = initialPeople } = trpc.people.listAll.useQuery(
    undefined,
    { initialData: initialPeople },
  );

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });

  // Mutations. update / deactivate / reactivate patch listAll optimistically;
  // onSettled also invalidates the read-only people.list (used by Board column
  // headers and the new-card assignee picker) and cards.list (deactivate
  // reassigns active cards to Backlog server-side).
  const refreshSiblings = () => {
    void utils.people.list.invalidate();
    void utils.cards.list.invalidate();
  };

  const updateMutation = trpc.people.update.useMutation({
    ...useOptimisticListMutation<
      { id: string; name?: string; email?: string | null; color?: string; role?: Role },
      Person
    >(utils.people.listAll, (old, input) =>
      old.map((p) =>
        p.id !== input.id
          ? p
          : {
              ...p,
              ...(input.name !== undefined && { name: input.name }),
              ...(input.email !== undefined && { email: input.email }),
              ...(input.color !== undefined && { color: input.color }),
              ...(input.role !== undefined && { role: input.role }),
            },
      ),
    ),
    onSettled: () => {
      void utils.people.listAll.invalidate();
      refreshSiblings();
    },
  });

  const deactivateMutation = trpc.people.deactivate.useMutation({
    ...useOptimisticListMutation<{ id: string }, Person>(
      utils.people.listAll,
      (old, input) =>
        old.map((p) => (p.id === input.id ? { ...p, active: false } : p)),
    ),
    onSettled: () => {
      void utils.people.listAll.invalidate();
      refreshSiblings();
    },
  });

  const reactivateMutation = trpc.people.reactivate.useMutation({
    ...useOptimisticListMutation<{ id: string }, Person>(
      utils.people.listAll,
      (old, input) =>
        old.map((p) => (p.id === input.id ? { ...p, active: true } : p)),
    ),
    onSettled: () => {
      void utils.people.listAll.invalidate();
      refreshSiblings();
    },
  });

  const createMutation = trpc.people.create.useMutation({
    onSettled: () => {
      void utils.people.listAll.invalidate();
      refreshSiblings();
    },
  });

  const activeCount = people.filter((p) => p.active).length;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>People</h1>
          <p className="admin-sub">
            {people.length} {people.length === 1 ? "person" : "people"} ·{" "}
            {activeCount} active. Deactivating moves the person&rsquo;s active
            cards to Backlog.
          </p>
        </div>
        <div className="admin-toolbar">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setModal({ kind: "create" })}
          >
            + Add person
          </button>
        </div>
      </div>

      <DataTable.Root>
        <DataTable.Head>
          <DataTable.HeaderCell width="56px"> </DataTable.HeaderCell>
          <DataTable.HeaderCell>Name</DataTable.HeaderCell>
          <DataTable.HeaderCell>Email</DataTable.HeaderCell>
          <DataTable.HeaderCell width="130px">Role</DataTable.HeaderCell>
          <DataTable.HeaderCell width="100px">Status</DataTable.HeaderCell>
          <DataTable.HeaderCell width="200px" align="right">
            Actions
          </DataTable.HeaderCell>
        </DataTable.Head>
        <DataTable.Body>
          {people.map((p) => (
            <DataTable.Row key={p.id} dim={!p.active}>
              <DataTable.Cell>
                <span
                  className="avatar-sm"
                  style={{ background: p.color }}
                  aria-hidden="true"
                >
                  {initialsOf(p.name)}
                </span>
              </DataTable.Cell>
              <DataTable.Cell>{p.name}</DataTable.Cell>
              <DataTable.Cell>{p.email ?? "—"}</DataTable.Cell>
              <DataTable.Cell>
                <span className={`role-pill ${ROLE_CLASS[p.role]}`}>
                  <span className="role-pill-tag">{ROLE_LABEL[p.role]}</span>
                </span>
              </DataTable.Cell>
              <DataTable.Cell>
                {p.active ? (
                  <span style={{ color: "var(--accent)" }}>Active</span>
                ) : (
                  <span style={{ color: "var(--ink-3)" }}>Inactive</span>
                )}
              </DataTable.Cell>
              <DataTable.Cell align="right">
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn-row"
                    onClick={() => setModal({ kind: "edit", person: p })}
                  >
                    Edit
                  </button>
                  {p.active ? (
                    <button
                      type="button"
                      className="btn-row is-danger"
                      onClick={() =>
                        deactivateMutation.mutate({ id: p.id })
                      }
                      disabled={deactivateMutation.isPending}
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-row"
                      onClick={() =>
                        reactivateMutation.mutate({ id: p.id })
                      }
                      disabled={reactivateMutation.isPending}
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </DataTable.Cell>
            </DataTable.Row>
          ))}
        </DataTable.Body>
      </DataTable.Root>
      {people.length === 0 && (
        <DataTable.Empty>
          No people yet. Use &ldquo;Add person&rdquo; to seed the team.
        </DataTable.Empty>
      )}

      <PersonEditModal
        state={modal}
        viewerRole={viewerRole}
        onClose={() => setModal({ kind: "closed" })}
        onCreate={(data) => createMutation.mutate(data)}
        onUpdate={(data) => updateMutation.mutate(data)}
      />
    </>
  );
}
