"use client";

// New opportunity — sprint-15.md scope item 3. A prospect is a Client
// (domain decision 1), so a brand-new one is created inline here instead
// of sending the user to the clients tab first.
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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
  Select,
} from "@andes/ui";

import { localDay } from "@/lib/format";
import { trpc } from "@/lib/trpc";

import { SOURCE_SUGGESTIONS } from "./pipeline-meta";

const NEW_CLIENT = "__new__";

const blank = {
  clientId: "",
  newClientName: "",
  title: "",
  estimatedValue: "",
  source: "",
  nextAction: "",
  nextActionAt: "",
};

export function NewOpportunityDialog({ clientId }: { clientId?: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank, clientId: clientId ?? "" });
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const utils = trpc.useUtils();
  const clients = trpc.clients.list.useQuery(undefined, { enabled: open });
  const createClient = trpc.clients.create.useMutation();
  const create = trpc.opportunities.create.useMutation();
  const busy = createClient.isPending || create.isPending;

  const set = (key: keyof typeof blank) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const isNew = form.clientId === NEW_CLIENT;
    if (!form.clientId || (isNew && !form.newClientName.trim())) {
      setError("Pick a client or name the new prospect.");
      return;
    }
    if (!form.title.trim()) {
      setError("Describe what they need.");
      return;
    }
    const value = form.estimatedValue ? Number(form.estimatedValue) : undefined;
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      setError("The estimated value must be a positive number.");
      return;
    }
    try {
      const client = isNew
        ? await createClient.mutateAsync({ name: form.newClientName.trim() })
        : { id: form.clientId };
      const created = await create.mutateAsync({
        clientId: client.id,
        title: form.title.trim(),
        estimatedValue: value,
        source: form.source.trim() || undefined,
        nextAction: form.nextAction.trim() || undefined,
        nextActionAt: form.nextActionAt || undefined,
      });
      void utils.opportunities.list.invalidate();
      void utils.clients.list.invalidate();
      setOpen(false);
      setForm({ ...blank, clientId: clientId ?? "" });
      router.push(`/crm/pipeline/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          New opportunity
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New opportunity</DialogTitle>
          <DialogDescription>
            Someone asked for work. Record who, what, and when you will get back
            to them.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="opp-client">Client or prospect</Label>
            <Select
              id="opp-client"
              value={form.clientId}
              onChange={(e) => set("clientId")(e.target.value)}
            >
              <option value="">— Pick one —</option>
              <option value={NEW_CLIENT}>+ New prospect…</option>
              {clients.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          {form.clientId === NEW_CLIENT && (
            <div className="space-y-1.5">
              <Label htmlFor="opp-new-client">Prospect name</Label>
              <Input
                id="opp-new-client"
                autoFocus
                placeholder="Company or person"
                value={form.newClientName}
                onChange={(e) => set("newClientName")(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Added to Clients — complete their details later.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="opp-title">What do they need?</Label>
            <Input
              id="opp-title"
              placeholder="e.g. Structural design, 5-storey building"
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="opp-value">Estimated value (COP)</Label>
              <Input
                id="opp-value"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                placeholder="Optional"
                value={form.estimatedValue}
                onChange={(e) => set("estimatedValue")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-source">Where did it come from?</Label>
              <Input
                id="opp-source"
                list="opp-sources"
                placeholder="Optional"
                value={form.source}
                onChange={(e) => set("source")(e.target.value)}
              />
              <datalist id="opp-sources">
                {SOURCE_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-4 rounded-lg bg-muted/60 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="opp-next">Next step</Label>
              <Input
                id="opp-next"
                placeholder="e.g. Call back with a quote"
                value={form.nextAction}
                onChange={(e) => set("nextAction")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-next-at">When</Label>
              <Input
                id="opp-next-at"
                type="date"
                min={localDay()}
                value={form.nextActionAt}
                onChange={(e) => set("nextActionAt")(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Create opportunity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
