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
  "Price",
  "Chose another firm",
  "Project cancelled",
  "No response",
  "Out of our scope",
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
          <DialogTitle>Mark as lost</DialogTitle>
          <DialogDescription>
            “{title}” — why did it not go ahead? You can reopen it later if the
            client comes back.
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
            <Label htmlFor="lost-reason">Reason</Label>
            <Input
              id="lost-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Pick one above or write your own"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !reason.trim()}>
              {busy ? "Saving…" : "Mark as lost"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
