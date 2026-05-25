"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import type { Role } from "@prisma/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { PALETTE } from "@/lib/palette";

type Person = RouterOutputs["people"]["listAll"][number];

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; person: Person };

type Draft = {
  name: string;
  email: string;
  color: string;
  role: Role;
};

type CreateInput = {
  name: string;
  email?: string;
  color: string;
  role: Role;
};

type UpdateInput = {
  id: string;
  name?: string;
  email?: string | null;
  color?: string;
  role?: Role;
};

type Props = {
  state: ModalState;
  viewerRole: Role;
  onClose: () => void;
  onCreate: (input: CreateInput) => void;
  onUpdate: (input: UpdateInput) => void;
};

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
];

const EMPTY_DRAFT: Draft = {
  name: "",
  email: "",
  color: PALETTE[0]!.hex,
  role: "EMPLOYEE",
};

export function PersonEditModal({
  state,
  viewerRole,
  onClose,
  onCreate,
  onUpdate,
}: Props) {
  const mode = state.kind;
  const open = mode !== "closed";
  // Manager can promote/demote; Admin sees the role as a read-only chip
  // (the People router rejects role patches from non-Manager too).
  const canEditRole = viewerRole === "MANAGER";

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  useEffect(() => {
    if (state.kind === "edit") {
      setDraft({
        name: state.person.name,
        email: state.person.email ?? "",
        color: state.person.color,
        role: state.person.role,
      });
    } else if (state.kind === "create") {
      setDraft(EMPTY_DRAFT);
    }
  }, [state]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const canSave = draft.name.trim().length > 0;

  const handleSave = () => {
    const trimmedName = draft.name.trim();
    const trimmedEmail = draft.email.trim();
    if (state.kind === "create") {
      onCreate({
        name: trimmedName,
        email: trimmedEmail.length > 0 ? trimmedEmail : undefined,
        color: draft.color,
        role: draft.role,
      });
    } else if (state.kind === "edit") {
      const original = state.person;
      const patch: UpdateInput = { id: original.id };
      if (trimmedName !== original.name) patch.name = trimmedName;
      const normalizedEmail = trimmedEmail.length > 0 ? trimmedEmail : null;
      if (normalizedEmail !== (original.email ?? null)) patch.email = normalizedEmail;
      if (draft.color !== original.color) patch.color = draft.color;
      if (canEditRole && draft.role !== original.role) patch.role = draft.role;
      // Always submit even if nothing changed — the modal-close UX expects
      // the action to feel applied. Server is idempotent.
      onUpdate(patch);
    }
    onClose();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content className="modal">
          <div className="modal-head">
            <Dialog.Title asChild>
              <h2>{mode === "edit" ? "Edit person" : "Add person"}</h2>
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              {mode === "edit"
                ? "Update the name, email, color, or role for this person."
                : "Add a new person. Email is optional and only needed if they will sign in."}
            </Dialog.Description>
            <Dialog.Close className="modal-close" aria-label="Close">
              ✕
            </Dialog.Close>
          </div>

          <div className="modal-body">
            <div className="field">
              <label className="field-label" htmlFor="person-name">
                Name
              </label>
              <input
                id="person-name"
                type="text"
                autoFocus
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="person-email">
                Email (optional)
              </label>
              <input
                id="person-email"
                type="email"
                value={draft.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="name@example.com"
              />
              <p className="field-hint">
                Needed only if this person will sign in. The email must match
                an entry on the Access page allowlist before sign-in works.
              </p>
            </div>

            <div className="field">
              <label className="field-label">Color</label>
              <div
                className="swatch-row"
                role="radiogroup"
                aria-label="Person color"
              >
                {PALETTE.map((sw) => (
                  <button
                    key={sw.hex}
                    type="button"
                    role="radio"
                    aria-checked={draft.color === sw.hex}
                    aria-label={sw.name}
                    className={`swatch${draft.color === sw.hex ? " is-selected" : ""}`}
                    style={{ background: sw.hex }}
                    onClick={() => set("color", sw.hex)}
                    title={sw.name}
                  />
                ))}
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="person-role">
                Role
              </label>
              {canEditRole ? (
                <select
                  id="person-role"
                  value={draft.role}
                  onChange={(e) => set("role", e.target.value as Role)}
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="field-hint">
                  Role: <strong>{draft.role}</strong>. Only Manager can
                  promote or demote.
                </p>
              )}
              {canEditRole && (
                <p className="field-hint">
                  Role changes take effect the next time this person signs in
                  (their session JWT is stamped at sign-in time).
                </p>
              )}
            </div>
          </div>

          <div className="modal-foot">
            <Dialog.Close asChild>
              <button type="button" className="btn-ghost">
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={!canSave}
            >
              {mode === "edit" ? "Save changes" : "Create person"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
