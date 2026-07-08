"use client";

// Shared create/edit client form (sprint-3.md scope item 3). The API
// re-validates with its own schemas; this layer is for user feedback.
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, Input, Label, Textarea } from "@andes/ui";

const formSchema = z.object({
  name: z.string().trim().min(1, "Required").max(200),
  taxId: z.string().trim().max(200),
  industry: z.string().trim().max(200),
  address: z.string().trim().max(200),
  city: z.string().trim().max(200),
  phone: z.string().trim().max(200),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Invalid email",
    }),
  notes: z.string().trim().max(2000),
});

export type ClientFormValues = z.infer<typeof formSchema>;

// "" normalized to null so the API clears fields on edit.
export type ClientFormPayload = {
  name: string;
} & {
  [K in Exclude<keyof ClientFormValues, "name">]: string | null;
};

const emptyValues: ClientFormValues = {
  name: "",
  taxId: "",
  industry: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  notes: "",
};

export function ClientForm({
  defaultValues,
  submitLabel,
  busy,
  errorMessage,
  onSubmit,
}: {
  defaultValues?: Partial<ClientFormValues>;
  submitLabel: string;
  busy: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: ClientFormPayload) => void;
}) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...emptyValues, ...defaultValues },
  });
  const errors = form.formState.errors;

  function submit(values: ClientFormValues) {
    onSubmit({
      name: values.name,
      taxId: values.taxId || null,
      industry: values.industry || null,
      address: values.address || null,
      city: values.city || null,
      phone: values.phone || null,
      email: values.email || null,
      notes: values.notes || null,
    });
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="client-name">Name</Label>
          <Input id="client-name" {...form.register("name")} />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client-taxid">Tax ID (NIT)</Label>
          <Input
            id="client-taxid"
            placeholder="900.123.456-7"
            className="font-mono"
            {...form.register("taxId")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="client-industry">Industry</Label>
          <Input id="client-industry" {...form.register("industry")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client-city">City</Label>
          <Input id="client-city" {...form.register("city")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="client-address">Address</Label>
        <Input id="client-address" {...form.register("address")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="client-phone">Phone</Label>
          <Input id="client-phone" {...form.register("phone")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client-email">Email</Label>
          <Input id="client-email" {...form.register("email")} />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="client-notes">Notes</Label>
        <Textarea id="client-notes" {...form.register("notes")} />
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
