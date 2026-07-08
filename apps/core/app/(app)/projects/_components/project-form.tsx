"use client";

// Shared create/edit form (sprint-2.md scope item 3): React Hook Form +
// Zod per ADR-001 — their first use in the platform. The API re-validates
// with its own schemas; this layer exists for user feedback.
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, Input, Label, Select } from "@andes/ui";

import { trpc } from "@/lib/trpc";

const formSchema = z
  .object({
    code: z.string().trim().min(1, "Required").max(32),
    name: z.string().trim().min(1, "Required").max(200),
    description: z.string().trim().max(2000),
    clientId: z.string(), // "" = no client
    newClientName: z.string().trim().max(200),
    status: z.enum(["DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED"]),
    startDate: z.string(), // yyyy-mm-dd or ""
    endDate: z.string(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: "End date must not precede start date",
    path: ["endDate"],
  });

export type ProjectFormValues = z.infer<typeof formSchema>;

// What parents submit to the API: "" normalized away.
export interface ProjectFormPayload {
  code: string;
  name: string;
  description?: string;
  clientId?: string;
  newClientName?: string;
  status: ProjectFormValues["status"];
  startDate?: string;
  endDate?: string;
}

const emptyValues: ProjectFormValues = {
  code: "",
  name: "",
  description: "",
  clientId: "",
  newClientName: "",
  status: "DRAFT",
  startDate: "",
  endDate: "",
};

export function ProjectForm({
  defaultValues,
  submitLabel,
  busy,
  errorMessage,
  onSubmit,
}: {
  defaultValues?: Partial<ProjectFormValues>;
  submitLabel: string;
  busy: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: ProjectFormPayload) => void;
}) {
  const clients = trpc.clients.list.useQuery();
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...emptyValues, ...defaultValues },
  });

  function submit(values: ProjectFormValues) {
    onSubmit({
      code: values.code,
      name: values.name,
      description: values.description || undefined,
      clientId: values.clientId || undefined,
      newClientName: values.newClientName || undefined,
      status: values.status,
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
    });
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="project-code">Code</Label>
          <Input
            id="project-code"
            placeholder="P-2026-001"
            className="font-mono"
            {...form.register("code")}
          />
          {errors.code && (
            <p className="text-xs text-destructive">{errors.code.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="project-status">Status</Label>
          <Select id="project-status" {...form.register("status")}>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On hold</option>
            <option value="COMPLETED">Completed</option>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="project-name">Name</Label>
        <Input id="project-name" {...form.register("name")} />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="project-description">Description</Label>
        <Input id="project-description" {...form.register("description")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="project-client">Client</Label>
          <Select id="project-client" {...form.register("clientId")}>
            <option value="">— No client —</option>
            {(clients.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="project-new-client">…or create client</Label>
          <Input
            id="project-new-client"
            placeholder="New client name"
            {...form.register("newClientName")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="project-start">Start date</Label>
          <Input
            id="project-start"
            type="date"
            {...form.register("startDate")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="project-end">End date</Label>
          <Input id="project-end" type="date" {...form.register("endDate")} />
          {errors.endDate && (
            <p className="text-xs text-destructive">{errors.endDate.message}</p>
          )}
        </div>
      </div>

      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? "…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
