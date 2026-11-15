"use client";

// Losing requires a reason (sprint-15-domain-model.md, rules).
import { useState, type FormEvent } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@andes/ui";

const REASONS = [
  "Precio",
  "Eligió otra firma",
  "Proyecto cancelado",
  "Sin respuesta",
  "Fuera de nuestro alcance",
];

export function LostDialog({
  title,
  open,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  open: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim()) onConfirm(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como perdida</DialogTitle>
          <DialogDescription>
            “{title}”: ¿por qué no siguió adelante? Puedes reabrirla después si
            el cliente vuelve.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                aria-pressed={reason === r}
                className={
                  reason === r
                    ? "rounded-full border border-primary bg-primary/10 px-3 py-1 text-sm text-primary"
                    : "rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
                }
              >
                {r}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lost-reason">Motivo</Label>
            <Input
              id="lost-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Elige uno arriba o escribe el tuyo"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !reason.trim()}>
              {busy ? "Guardando…" : "Marcar como perdida"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
