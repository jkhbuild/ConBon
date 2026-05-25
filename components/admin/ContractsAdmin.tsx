"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useOptimisticListMutation } from "@/lib/hooks/useOptimisticListMutation";
import type { RouterOutputs } from "@/lib/trpc/types";
import { DataTable } from "./DataTable";
import { ContractEditModal } from "./ContractEditModal";

type Contract = RouterOutputs["contracts"]["listAll"][number];

type Props = {
  initialContracts: Contract[];
};

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; contract: Contract };

export function ContractsAdmin({ initialContracts }: Props) {
  const utils = trpc.useUtils();
  const { data: contracts = initialContracts } =
    trpc.contracts.listAll.useQuery(undefined, { initialData: initialContracts });

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });

  const refreshSiblings = () => {
    void utils.contracts.list.invalidate();
    void utils.cards.list.invalidate(); // chip color may have changed
  };

  const updateMutation = trpc.contracts.update.useMutation({
    ...useOptimisticListMutation<
      { id: string; code?: string; name?: string; color?: string | null },
      Contract
    >(utils.contracts.listAll, (old, input) =>
      old.map((c) =>
        c.id !== input.id
          ? c
          : {
              ...c,
              ...(input.code !== undefined && { code: input.code }),
              ...(input.name !== undefined && { name: input.name }),
              ...(input.color !== undefined && { color: input.color }),
            },
      ),
    ),
    onSettled: () => {
      void utils.contracts.listAll.invalidate();
      refreshSiblings();
    },
  });

  const deactivateMutation = trpc.contracts.deactivate.useMutation({
    ...useOptimisticListMutation<{ id: string }, Contract>(
      utils.contracts.listAll,
      (old, input) =>
        old.map((c) => (c.id === input.id ? { ...c, active: false } : c)),
    ),
    onSettled: () => {
      void utils.contracts.listAll.invalidate();
      refreshSiblings();
    },
  });

  const reactivateMutation = trpc.contracts.reactivate.useMutation({
    ...useOptimisticListMutation<{ id: string }, Contract>(
      utils.contracts.listAll,
      (old, input) =>
        old.map((c) => (c.id === input.id ? { ...c, active: true } : c)),
    ),
    onSettled: () => {
      void utils.contracts.listAll.invalidate();
      refreshSiblings();
    },
  });

  const createMutation = trpc.contracts.create.useMutation({
    onSettled: () => {
      void utils.contracts.listAll.invalidate();
      refreshSiblings();
    },
  });

  const activeCount = contracts.filter((c) => c.active).length;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Contracts</h1>
          <p className="admin-sub">
            {contracts.length}{" "}
            {contracts.length === 1 ? "contract" : "contracts"} · {activeCount}{" "}
            active. Existing cards keep their contract chip even after a
            contract is deactivated.
          </p>
        </div>
        <div className="admin-toolbar">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setModal({ kind: "create" })}
          >
            + Add contract
          </button>
        </div>
      </div>

      <DataTable.Root>
        <DataTable.Head>
          <DataTable.HeaderCell width="56px"> </DataTable.HeaderCell>
          <DataTable.HeaderCell width="120px">Code</DataTable.HeaderCell>
          <DataTable.HeaderCell>Name</DataTable.HeaderCell>
          <DataTable.HeaderCell width="100px">Status</DataTable.HeaderCell>
          <DataTable.HeaderCell width="200px" align="right">
            Actions
          </DataTable.HeaderCell>
        </DataTable.Head>
        <DataTable.Body>
          {contracts.map((c) => (
            <DataTable.Row key={c.id} dim={!c.active}>
              <DataTable.Cell>
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: c.color ?? "var(--surface-2)",
                    border: c.color
                      ? "1px solid var(--line)"
                      : "1px dashed var(--line-strong)",
                  }}
                />
              </DataTable.Cell>
              <DataTable.Cell>
                <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {c.code}
                </code>
              </DataTable.Cell>
              <DataTable.Cell>{c.name}</DataTable.Cell>
              <DataTable.Cell>
                {c.active ? (
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
                    onClick={() => setModal({ kind: "edit", contract: c })}
                  >
                    Edit
                  </button>
                  {c.active ? (
                    <button
                      type="button"
                      className="btn-row is-danger"
                      onClick={() =>
                        deactivateMutation.mutate({ id: c.id })
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
                        reactivateMutation.mutate({ id: c.id })
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
      {contracts.length === 0 && (
        <DataTable.Empty>
          No contracts yet. Use &ldquo;Add contract&rdquo; to seed work.
        </DataTable.Empty>
      )}

      <ContractEditModal
        state={modal}
        onClose={() => setModal({ kind: "closed" })}
        onCreate={(data) => createMutation.mutate(data)}
        onUpdate={(data) => updateMutation.mutate(data)}
      />
    </>
  );
}
