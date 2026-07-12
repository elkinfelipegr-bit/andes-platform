"use client";

// Add/edit bearing capacity check. Numeric fields stay strings in the
// form (the Zod 4 / RHF resolver convention) and convert on submit; the
// SERVER computes via @andes/geo — this dialog never calculates.
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
  Select,
} from "@andes/ui";

import { trpc } from "@/lib/trpc";

const inRange = (min: number, max: number, message: string) =>
  z.string().refine(
    (v) => {
      const n = Number(v);
      return v !== "" && !Number.isNaN(n) && n >= min && n <= max;
    },
    { message },
  );

const formSchema = z.object({
  label: z.string().trim().min(1, "Required").max(200),
  b: inRange(0.01, 100, "> 0 m"),
  df: inRange(0, 100, "≥ 0 m"),
  gamma: inRange(5, 30, "5–30 kN/m³"),
  c: inRange(0, 1000, "0–1000 kPa"),
  phi: inRange(0, 50, "0–50°"),
  fs: inRange(1, 10, "1–10"),
  shape: z.enum(["STRIP", "SQUARE"]),
});

type CheckFormValues = z.infer<typeof formSchema>;

export function BearingCheckDialog({
  geoRecordId,
  check,
  trigger,
}: {
  geoRecordId: string;
  // Present = edit mode; absent = add mode.
  check?: {
    id: string;
    label: string;
    b: number;
    df: number;
    gamma: number;
    c: number;
    phi: number;
    fs: number;
    shape: "STRIP" | "SQUARE";
  };
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const onSuccess = () => {
    void utils.geoRecords.get.invalidate({ id: geoRecordId });
    void utils.geoRecords.list.invalidate();
    setOpen(false);
  };
  const add = trpc.geoRecords.addCheck.useMutation({ onSuccess });
  const update = trpc.geoRecords.updateCheck.useMutation({ onSuccess });

  const defaults = (): CheckFormValues => ({
    label: check?.label ?? "",
    b: check ? String(check.b) : "1.50",
    df: check ? String(check.df) : "1.50",
    gamma: check ? String(check.gamma) : "18",
    c: check ? String(check.c) : "0",
    phi: check ? String(check.phi) : "30",
    fs: check ? String(check.fs) : "3",
    shape: check?.shape ?? "SQUARE",
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
    const inputs = {
      label: values.label,
      b: Number(values.b),
      df: Number(values.df),
      gamma: Number(values.gamma),
      c: Number(values.c),
      phi: Number(values.phi),
      fs: Number(values.fs),
      shape: values.shape,
    };
    if (check) {
      update.mutate({ id: check.id, ...inputs });
    } else {
      add.mutate({ geoRecordId, ...inputs });
    }
  }

  const busy = add.isPending || update.isPending;
  const errorMessage = add.error?.message ?? update.error?.message ?? null;
  const errors = form.formState.errors;

  const numberField = (
    name: keyof Omit<CheckFormValues, "label" | "shape">,
    label: string,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`bc-${name}`}>{label}</Label>
      <Input
        id={`bc-${name}`}
        type="number"
        step="any"
        className="font-mono"
        {...form.register(name)}
      />
      {errors[name] && (
        <p className="text-xs text-destructive">{errors[name]?.message}</p>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {check ? "Edit bearing check" : "New bearing capacity check"}
          </DialogTitle>
          <DialogDescription>
            General bearing capacity equation (Vesic factors) — the server
            computes q_ult and q_adm when you save.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bc-label">Footing</Label>
            <Input
              id="bc-label"
              placeholder="Zapata Z-1"
              {...form.register("label")}
            />
            {errors.label && (
              <p className="text-xs text-destructive">{errors.label.message}</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {numberField("b", "B — width (m)")}
            {numberField("df", "Df — depth (m)")}
            <div className="space-y-1.5">
              <Label htmlFor="bc-shape">Shape</Label>
              <Select id="bc-shape" {...form.register("shape")}>
                <option value="SQUARE">Square</option>
                <option value="STRIP">Strip</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {numberField("gamma", "γ (kN/m³)")}
            {numberField("c", "c (kPa)")}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {numberField("phi", "φ (degrees)")}
            {numberField("fs", "FS")}
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
