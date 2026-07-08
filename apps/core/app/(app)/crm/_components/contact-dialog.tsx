"use client";

// Add/edit contact dialog (sprint-3.md scope item 3). Contacts are the
// firm's counterparts at a client — address-book data, hard-deleted.
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@andes/ui";

import { trpc } from "@/lib/trpc";

const formSchema = z.object({
  name: z.string().trim().min(1, "Required").max(200),
  title: z.string().trim().max(200),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Invalid email",
    }),
  phone: z.string().trim().max(200),
});

type ContactFormValues = z.infer<typeof formSchema>;

export function ContactDialog({
  clientId,
  contact,
  trigger,
}: {
  clientId: string;
  // Present = edit mode; absent = create mode.
  contact?: {
    id: string;
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
  };
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const onSuccess = () => {
    void utils.clients.get.invalidate({ id: clientId });
    void utils.clients.list.invalidate();
    setOpen(false);
  };
  const create = trpc.contacts.create.useMutation({ onSuccess });
  const update = trpc.contacts.update.useMutation({ onSuccess });

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: contact?.name ?? "",
      title: contact?.title ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
    },
  });

  // Re-seed the form when reopening for a different row state.
  useEffect(() => {
    if (open) {
      form.reset({
        name: contact?.name ?? "",
        title: contact?.title ?? "",
        email: contact?.email ?? "",
        phone: contact?.phone ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function submit(values: ContactFormValues) {
    if (contact) {
      update.mutate({
        id: contact.id,
        name: values.name,
        title: values.title || null,
        email: values.email || null,
        phone: values.phone || null,
      });
    } else {
      create.mutate({
        clientId,
        name: values.name,
        title: values.title || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
      });
    }
  }

  const busy = create.isPending || update.isPending;
  const errorMessage = create.error?.message ?? update.error?.message ?? null;
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "New contact"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="contact-name">Name</Label>
            <Input id="contact-name" {...form.register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-title">Title / role</Label>
            <Input
              id="contact-title"
              placeholder="Interventor, Gerente…"
              {...form.register("title")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input id="contact-email" {...form.register("email")} />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input id="contact-phone" {...form.register("phone")} />
            </div>
          </div>

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? "…" : contact ? "Save contact" : "Add contact"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
