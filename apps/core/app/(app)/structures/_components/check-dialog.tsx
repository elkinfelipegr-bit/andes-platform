"use client";

// Add/edit beam flexure check. Geometry fields stay strings in the form
// (the Zod 4 / RHF resolver convention) and convert on submit; the SERVER
// computes via @andes/structures — this dialog never calculates.
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@andes/ui";

import { trpc } from "@/lib/trpc";

const positive = (max: number, message: string) =>
  z.string().refine((v) => Number(v) > 0 && Number(v) <= max, { message });

const formSchema = z.object({
  label: z.string().trim().min(1, "Required").max(200),
  b: positive(10_000, "> 0 mm"),
  h: positive(10_000, "> 0 mm"),
  cover: positive(1_000, "> 0 mm"),
  mu: positive(100_000_000, "> 0 kN·m"),
});

type CheckFormValues = z.infer<typeof formSchema>;

export function CheckDialog({
  calcRecordId,
  check,
  trigger,
}: {
  calcRecordId: string;
  // Present = edit mode; absent = add mode.
  check?: {
    id: string;
    label: string;
    b: number;
    h: number;
    cover: number;
    mu: number;
  };
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const onSuccess = () => {
    void utils.calcRecords.get.invalidate({ id: calcRecordId });
    void utils.calcRecords.list.invalidate();
    setOpen(false);
  };
  const add = trpc.calcRecords.addCheck.useMutation({ onSuccess });
  const update = trpc.calcRecords.updateCheck.useMutation({ onSuccess });

  const defaults = (): CheckFormValues => ({
    label: check?.label ?? "",
    b: check ? String(check.b) : "300",
    h: check ? String(check.h) : "500",
    cover: check ? String(check.cover) : "60",
    mu: check ? String(check.mu) : "",
  });

  const form = useForm<CheckFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    if (open) form.reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function submit(values: CheckFormValues) {
    const geometry = {
      label: values.label,
      b: Number(values.b),
      h: Number(values.h),
      cover: Number(values.cover),
      mu: Number(values.mu),
    };
    if (check) {
      update.mutate({ id: check.id, ...geometry });
    } else {
      add.mutate({ calcRecordId, ...geometry });
    }
  }

  const busy = add.isPending || update.isPending;
  const errorMessage = add.error?.message ?? update.error?.message ?? null;
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {check ? "Edit beam check" : "New beam flexure check"}
          </DialogTitle>
          <DialogDescription>
            Rectangular RC section per NSR-10 C.10 — the server computes the
            required steel when you save.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="chk-label">Element</Label>
            <Input
              id="chk-label"
              placeholder="Viga eje 3, luz 2"
              {...form.register("label")}
            />
            {errors.label && (
              <p className="text-xs text-destructive">{errors.label.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="chk-b">b — width (mm)</Label>
              <Input
                id="chk-b"
                type="number"
                step="any"
                className="font-mono"
                {...form.register("b")}
              />
              {errors.b && (
                <p className="text-xs text-destructive">{errors.b.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chk-h">h — height (mm)</Label>
              <Input
                id="chk-h"
                type="number"
                step="any"
                className="font-mono"
                {...form.register("h")}
              />
              {errors.h && (
                <p className="text-xs text-destructive">{errors.h.message}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="chk-cover">Cover to steel (mm)</Label>
              <Input
                id="chk-cover"
                type="number"
                step="any"
                className="font-mono"
                {...form.register("cover")}
              />
              {errors.cover && (
                <p className="text-xs text-destructive">
                  {errors.cover.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chk-mu">Mu (kN·m)</Label>
              <Input
                id="chk-mu"
                type="number"
                step="any"
                className="font-mono"
                {...form.register("mu")}
              />
              {errors.mu && (
                <p className="text-xs text-destructive">{errors.mu.message}</p>
              )}
            </div>
          </div>

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? "…" : check ? "Recompute & save" : "Compute & add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
