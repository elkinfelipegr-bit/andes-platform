"use client";

// Permanent deletion with a typed confirmation (sprint-16-domain-model.md).
// Deleting is for records created by mistake or as a test; the dialog says
// exactly what goes with the record and asks for its name, so it cannot
// happen by a stray click.
import { Trash2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@andes/ui";

export function ConfirmDelete({
  what,
  name,
  consequences,
  busy,
  error,
  onConfirm,
}: {
  // e.g. "el cliente"
  what: string;
  // The text the user must type to confirm.
  name: string;
  consequences: ReactNode;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (matches) onConfirm();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="text-destructive">
          <Trash2 aria-hidden="true" />
          Eliminar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar {what}</DialogTitle>
          <DialogDescription>
            Esta acción es permanente y no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            {consequences}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-delete-name">
              Para confirmar, escribe{" "}
              <span className="font-semibold">{name}</span>
            </Label>
            <Input
              id="confirm-delete-name"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!matches || busy}
            >
              {busy ? "Eliminando…" : "Eliminar definitivamente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
