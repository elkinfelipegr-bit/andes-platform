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
      setError("Elige un cliente o escribe el nombre del nuevo prospecto.");
      return;
    }
    if (!form.title.trim()) {
      setError("Describe qué necesita.");
      return;
    }
    const value = form.estimatedValue ? Number(form.estimatedValue) : undefined;
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      setError("El valor estimado debe ser un número positivo.");
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
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          Nueva oportunidad
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva oportunidad</DialogTitle>
          <DialogDescription>
            Alguien pidió trabajo. Registra quién, qué necesita y cuándo le vas
            a responder.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="opp-client">Cliente o prospecto</Label>
            <Select
              id="opp-client"
              value={form.clientId}
              onChange={(e) => set("clientId")(e.target.value)}
            >
              <option value="">— Elige uno —</option>
              <option value={NEW_CLIENT}>+ Nuevo prospecto…</option>
              {clients.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          {form.clientId === NEW_CLIENT && (
            <div className="space-y-1.5">
              <Label htmlFor="opp-new-client">Nombre del prospecto</Label>
              <Input
                id="opp-new-client"
                autoFocus
                placeholder="Empresa o persona"
                value={form.newClientName}
                onChange={(e) => set("newClientName")(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Se agrega a Clientes; completa sus datos después.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="opp-title">¿Qué necesita?</Label>
            <Input
              id="opp-title"
              placeholder="p. ej. Diseño estructural, edificio de 5 pisos"
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="opp-value">Valor estimado (COP)</Label>
              <Input
                id="opp-value"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                placeholder="Opcional"
                value={form.estimatedValue}
                onChange={(e) => set("estimatedValue")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-source">¿De dónde llegó?</Label>
              <Input
                id="opp-source"
                list="opp-sources"
                placeholder="Opcional"
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
              <Label htmlFor="opp-next">Próximo paso</Label>
              <Input
                id="opp-next"
                placeholder="p. ej. Llamar con la cotización"
                value={form.nextAction}
                onChange={(e) => set("nextAction")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-next-at">Cuándo</Label>
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
              {busy ? "Guardando…" : "Crear oportunidad"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
