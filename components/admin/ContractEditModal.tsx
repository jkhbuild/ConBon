"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import type { RouterOutputs } from "@/lib/trpc/types";
import { PALETTE } from "@/lib/palette";

type Contract = RouterOutputs["contracts"]["listAll"][number];

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; contract: Contract };

type Draft = {
  code: string;
  name: string;
  color: string | null;
};

type CreateInput = {
  code: string;
  name: string;
  color?: string | null;
};

type UpdateInput = {
  id: string;
  code?: string;
  name?: string;
  color?: string | null;
};

type Props = {
  state: ModalState;
  onClose: () => void;
  onCreate: (input: CreateInput) => void;
  onUpdate: (input: UpdateInput) => void;
};

const CODE_PATTERN = /^[A-Z]\d{5}$/;

const EMPTY_DRAFT: Draft = {
  code: "",
  name: "",
  color: null,
};

export function ContractEditModal({ state, onClose, onCreate, onUpdate }: Props) {
  const mode = state.kind;
  const open = mode !== "closed";

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  useEffect(() => {
    if (state.kind === "edit") {
      setDraft({
        code: state.contract.code,
        name: state.contract.name,
        color: state.contract.color,
      });
    } else if (state.kind === "create") {
      setDraft(EMPTY_DRAFT);
    }
  }, [state]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const codeValid = CODE_PATTERN.test(draft.code);
  const nameValid = draft.name.trim().length > 0;
  const canSave = codeValid && nameValid;

  const handleSave = () => {
    const code = draft.code.trim();
    const name = draft.name.trim();
    if (state.kind === "create") {
      onCreate({
        code,
        name,
        color: draft.color,
      });
    } else if (state.kind === "edit") {
      const original = state.contract;
      const patch: UpdateInput = { id: original.id };
      if (code !== original.code) patch.code = code;
      if (name !== original.name) patch.name = name;
      if (draft.color !== original.color) patch.color = draft.color;
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
              <h2>{mode === "edit" ? "Edit contract" : "Add contract"}</h2>
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              {mode === "edit"
                ? "Update the code, name, or color for this contract."
                : "Add a new contract. Code must be one uppercase letter plus five digits."}
            </Dialog.Description>
            <Dialog.Close className="modal-close" aria-label="Close">
              ✕
            </Dialog.Close>
          </div>

          <div className="modal-body">
            <div className="field">
              <label className="field-label" htmlFor="contract-code">
                Code
              </label>
              <input
                id="contract-code"
                type="text"
                autoFocus
                value={draft.code}
                maxLength={6}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="e.g. N36054"
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              />
              {!codeValid && draft.code.length > 0 && (
                <p className="field-error">
                  Code must be one uppercase letter followed by five digits.
                </p>
              )}
              {draft.code.length === 0 && (
                <p className="field-hint">
                  Format: one uppercase letter + five digits (e.g. N36054).
                </p>
              )}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="contract-name">
                Name
              </label>
              <input
                id="contract-name"
                type="text"
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Northgate Tower"
              />
            </div>

            <div className="field">
              <label className="field-label">Color (optional)</label>
              <div
                className="swatch-row"
                role="radiogroup"
                aria-label="Contract color"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={draft.color === null}
                  aria-label="No color"
                  className={`swatch is-none${draft.color === null ? " is-selected" : ""}`}
                  onClick={() => set("color", null)}
                  title="No color"
                />
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
              <p className="field-hint">
                Contract chips on cards use this color as their dot. Choose
                &ldquo;No color&rdquo; for a neutral chip.
              </p>
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
              {mode === "edit" ? "Save changes" : "Create contract"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
