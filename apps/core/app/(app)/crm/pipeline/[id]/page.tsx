"use client";

// Opportunity detail — sprint-15.md scope item 3. One screen to work a
// prospect: where it stands, what was said, what happens next, and the
// quotes sent for it.
import {
  ArrowLeft,
  Check,
  CircleCheck,
  CircleX,
  Pencil,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  Textarea,
  cn,
} from "@andes/ui";

import {
  formatDate,
  formatDateTime,
  formatMoney,
  localDay,
  toDay,
} from "@/lib/format";
import { trpc, type RouterOutputs } from "@/lib/trpc";

import { CrmNav } from "../../_components/crm-nav";
import { ProposalStatusBadge } from "../../proposals/_components/proposal-status-badge";
import { FollowUpChip } from "../_components/follow-up-chip";
import { LostDialog } from "../_components/lost-dialog";
import {
  ACTIVITY_TYPES,
  OPEN_STAGES,
  SOURCE_SUGGESTIONS,
  STAGE_HINT,
  STAGE_LABEL,
  activityMeta,
  isOpen,
  type ActivityType,
  type FollowUp,
  type Stage,
} from "../_components/pipeline-meta";

type Detail = RouterOutputs["opportunities"]["get"];

const QUICK_DATES = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "In a week", days: 7 },
  { label: "In 2 weeks", days: 14 },
];

function followUpOf(o: Detail, today: string): FollowUp | null {
  if (!isOpen(o.stage)) return null;
  if (!o.nextActionAt) return "NONE";
  const day = toDay(o.nextActionAt);
  if (day < today) return "OVERDUE";
  return day === today ? "TODAY" : "UPCOMING";
}

function useRefresh(id: string) {
  const utils = trpc.useUtils();
  return () => {
    void utils.opportunities.get.invalidate({ id });
    void utils.opportunities.list.invalidate();
  };
}

// ── Stage stepper ──────────────────────────────────────────────────────
function StageStepper({ o }: { o: Detail }) {
  const refresh = useRefresh(o.id);
  const [losing, setLosing] = useState(false);
  const setStage = trpc.opportunities.setStage.useMutation({
    onSuccess: () => {
      refresh();
      setLosing(false);
    },
  });
  const currentIndex = OPEN_STAGES.indexOf(
    o.stage as (typeof OPEN_STAGES)[number],
  );
  const pick = (stage: Stage) =>
    stage !== o.stage && setStage.mutate({ id: o.id, stage });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-stretch gap-2">
        <ol className="flex min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
          {OPEN_STAGES.map((stage, i) => {
            const current = stage === o.stage;
            const passed = isOpen(o.stage)
              ? i < currentIndex
              : o.stage === "WON";
            return (
              <li key={stage} className="flex min-w-0 flex-1">
                <button
                  type="button"
                  title={STAGE_HINT[stage]}
                  aria-current={current ? "step" : undefined}
                  disabled={setStage.isPending}
                  onClick={() => pick(stage)}
                  className={cn(
                    "flex w-full items-center justify-center gap-1.5 border-r border-border px-2 py-2 text-sm font-medium transition-colors last:border-r-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                    current
                      ? "bg-primary text-primary-foreground"
                      : passed
                        ? "bg-primary/10 text-primary hover:bg-primary/15"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {passed && <Check aria-hidden="true" className="size-3.5" />}
                  <span className="truncate">{STAGE_LABEL[stage]}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <Button
          variant={o.stage === "WON" ? "default" : "outline"}
          disabled={setStage.isPending}
          aria-pressed={o.stage === "WON"}
          onClick={() => pick("WON")}
          className={cn(
            o.stage === "WON" &&
              "bg-success text-success-foreground hover:bg-success/90",
          )}
        >
          <CircleCheck aria-hidden="true" />
          Won
        </Button>
        <Button
          variant={o.stage === "LOST" ? "destructive" : "outline"}
          disabled={setStage.isPending}
          aria-pressed={o.stage === "LOST"}
          onClick={() => o.stage !== "LOST" && setLosing(true)}
        >
          <CircleX aria-hidden="true" />
          Lost
        </Button>
      </div>
      {setStage.error && !losing && (
        <p role="alert" className="text-sm text-destructive">
          {setStage.error.message}
        </p>
      )}
      <LostDialog
        title={o.title}
        open={losing}
        busy={setStage.isPending}
        error={setStage.error?.message ?? null}
        onCancel={() => setLosing(false)}
        onConfirm={(lostReason) =>
          setStage.mutate({ id: o.id, stage: "LOST", lostReason })
        }
      />
    </div>
  );
}

// ── Next step fields (shared by the composer and the side card) ────────
function NextStepFields({
  idPrefix,
  action,
  date,
  onAction,
  onDate,
}: {
  idPrefix: string;
  action: string;
  date: string;
  onAction: (v: string) => void;
  onDate: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-action`}>Next step</Label>
          <Input
            id={`${idPrefix}-action`}
            placeholder="e.g. Call to confirm they received the quote"
            value={action}
            onChange={(e) => onAction(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-date`}>When</Label>
          <Input
            id={`${idPrefix}-date`}
            type="date"
            value={date}
            onChange={(e) => onDate(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_DATES.map((q) => {
          const value = localDay(q.days);
          return (
            <button
              key={q.days}
              type="button"
              aria-pressed={date === value}
              onClick={() => onDate(value)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                date === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {q.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Activity composer ──────────────────────────────────────────────────
function ActivityComposer({ o }: { o: Detail }) {
  const refresh = useRefresh(o.id);
  const [type, setType] = useState<ActivityType>("CALL");
  const [body, setBody] = useState("");
  const [action, setAction] = useState("");
  const [date, setDate] = useState("");
  const open = isOpen(o.stage);
  const log = trpc.opportunities.logActivity.useMutation({
    onSuccess: () => {
      refresh();
      setBody("");
      setAction("");
      setDate("");
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const schedules = open && (action.trim() || date);
    log.mutate({
      opportunityId: o.id,
      type,
      body: body.trim(),
      ...(schedules
        ? {
            nextAction: action.trim() || o.nextAction || "Follow up",
            nextActionAt: date || null,
          }
        : {}),
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <div
        role="radiogroup"
        aria-label="Type of interaction"
        className="flex flex-wrap gap-1.5"
      >
        {ACTIVITY_TYPES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={type === key}
            onClick={() => setType(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              type === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="activity-body" className="sr-only">
          What happened
        </Label>
        <Textarea
          id="activity-body"
          rows={3}
          placeholder="What happened? What did they say?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      {open && (
        <div className="rounded-lg bg-muted/60 p-3">
          <NextStepFields
            idPrefix="composer"
            action={action}
            date={date}
            onAction={setAction}
            onDate={setDate}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Optional — replaces the current next step when filled in.
          </p>
        </div>
      )}
      {log.error && (
        <p role="alert" className="text-sm text-destructive">
          {log.error.message}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={log.isPending || !body.trim()}>
          {log.isPending ? "Saving…" : "Log activity"}
        </Button>
      </div>
    </form>
  );
}

function Timeline({ o }: { o: Detail }) {
  if (o.activities.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Nothing logged yet. Record the first contact above — it becomes the
        history of this opportunity.
      </p>
    );
  }
  return (
    <ol className="space-y-0">
      {o.activities.map((a, i) => {
        const meta = activityMeta(a.type);
        const Icon = meta.icon;
        return (
          <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < o.activities.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-8 bottom-0 left-4 w-px bg-border"
              />
            )}
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {meta.label}
                </span>{" "}
                · {formatDateTime(a.occurredAt)} · {a.createdBy.name}
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{a.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── Next step card ─────────────────────────────────────────────────────
function NextStepCard({ o, today }: { o: Detail; today: string }) {
  const refresh = useRefresh(o.id);
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState(o.nextAction ?? "");
  const [date, setDate] = useState(toDay(o.nextActionAt));
  const update = trpc.opportunities.update.useMutation({
    onSuccess: () => {
      refresh();
      setEditing(false);
    },
  });
  const state = followUpOf(o, today);

  if (!isOpen(o.stage)) return null;

  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-4",
        state === "OVERDUE"
          ? "border-destructive/50"
          : state === "NONE"
            ? "border-warning"
            : "border-border",
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Next step</h2>
        {state && (
          <FollowUpChip
            state={state}
            nextActionAt={o.nextActionAt}
            today={today}
          />
        )}
      </div>
      {editing ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({
              id: o.id,
              nextAction: action.trim() || null,
              nextActionAt: date || null,
            });
          }}
        >
          <NextStepFields
            idPrefix="next"
            action={action}
            date={date}
            onAction={setAction}
            onDate={setDate}
          />
          {update.error && (
            <p role="alert" className="text-sm text-destructive">
              {update.error.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={update.isPending}>
              Save
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="mt-2 text-sm">
            {o.nextAction ?? (
              <span className="text-muted-foreground">
                Nothing scheduled. Opportunities without a next step are the
                ones that get forgotten.
              </span>
            )}
          </p>
          {o.nextActionAt && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDate(o.nextActionAt)}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAction(o.nextAction ?? "");
                setDate(toDay(o.nextActionAt));
                setEditing(true);
              }}
            >
              {o.nextAction || o.nextActionAt ? "Reschedule" : "Set next step"}
            </Button>
            {(o.nextAction || o.nextActionAt) && (
              <Button
                variant="ghost"
                size="sm"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({
                    id: o.id,
                    nextAction: null,
                    nextActionAt: null,
                  })
                }
              >
                <Check aria-hidden="true" />
                Done
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ── Details + edit ─────────────────────────────────────────────────────
function EditDialog({ o }: { o: Detail }) {
  const refresh = useRefresh(o.id);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(o.title);
  const [value, setValue] = useState(
    o.estimatedValue === null ? "" : String(o.estimatedValue),
  );
  const [source, setSource] = useState(o.source ?? "");
  const [ownerId, setOwnerId] = useState(o.owner.id);
  const [contactId, setContactId] = useState(o.contact?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const members = trpc.core.members.useQuery(undefined, { enabled: open });
  const client = trpc.clients.get.useQuery(
    { id: o.client.id },
    { enabled: open },
  );
  const update = trpc.opportunities.update.useMutation({
    onSuccess: () => {
      refresh();
      setOpen(false);
    },
    onError: (e) => setError(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = value === "" ? null : Number(value);
    if (!title.trim()) return setError("The title is required.");
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      return setError("The estimated value must be a positive number.");
    }
    update.mutate({
      id: o.id,
      title: title.trim(),
      estimatedValue: amount,
      source: source.trim() || null,
      ownerId,
      contactId: contactId || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil aria-hidden="true" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit opportunity</DialogTitle>
          <DialogDescription>
            {o.client.name} — the client cannot be changed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">What do they need?</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-value">Estimated value ({o.currency})</Label>
              <Input
                id="edit-value"
                type="number"
                min={0}
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-source">Source</Label>
              <Input
                id="edit-source"
                list="edit-sources"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
              <datalist id="edit-sources">
                {SOURCE_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-owner">Owner</Label>
              <Select
                id="edit-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              >
                {!members.data && (
                  <option value={o.owner.id}>{o.owner.name}</option>
                )}
                {members.data?.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-contact">Contact</Label>
              <Select
                id="edit-contact"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
              >
                <option value="">— None —</option>
                {!client.data && o.contact && (
                  <option value={o.contact.id}>{o.contact.name}</option>
                )}
                {client.data?.contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function DetailsCard({ o }: { o: Detail }) {
  const person = o.contact;
  const phone = person?.phone ?? o.client.phone;
  const email = person?.email ?? o.client.email;
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Details</h2>
        <EditDialog o={o} />
      </div>
      <dl className="mt-1 divide-y divide-border">
        <Row label="Estimated value">
          {o.estimatedValue !== null ? (
            <span className="font-medium tabular-nums">
              {formatMoney(o.estimatedValue, o.currency)}
            </span>
          ) : (
            "—"
          )}
        </Row>
        <Row label="Client">
          <Link
            href={`/crm/${o.client.id}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            {o.client.name}
          </Link>
        </Row>
        <Row label="Contact">
          {person ? (
            <>
              {person.name}
              {person.title && (
                <span className="block text-xs text-muted-foreground">
                  {person.title}
                </span>
              )}
            </>
          ) : (
            "—"
          )}
        </Row>
        <Row label="Phone">
          {phone ? (
            <a
              href={`tel:${phone}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              {phone}
            </a>
          ) : (
            "—"
          )}
        </Row>
        <Row label="Email">
          {email ? (
            <a
              href={`mailto:${email}`}
              className="break-all text-primary underline-offset-2 hover:underline"
            >
              {email}
            </a>
          ) : (
            "—"
          )}
        </Row>
        <Row label="Source">{o.source ?? "—"}</Row>
        <Row label="Owner">{o.owner.name}</Row>
        <Row label="Created">{formatDate(o.createdAt)}</Row>
      </dl>
    </section>
  );
}

// ── Proposals ──────────────────────────────────────────────────────────
function NewProposalDialog({ o }: { o: Detail }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState(o.title);
  const router = useRouter();
  const create = trpc.proposals.create.useMutation({
    onSuccess: (created) => router.push(`/crm/proposals/${created.id}`),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus aria-hidden="true" />
          New proposal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New proposal for {o.client.name}</DialogTitle>
          <DialogDescription>
            Linked to this opportunity. You add the priced items on the next
            screen; sending it moves the opportunity to Quoted.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!code.trim() || !title.trim()) return;
            create.mutate({
              clientId: o.client.id,
              contactId: o.contact?.id,
              opportunityId: o.id,
              code: code.trim(),
              title: title.trim(),
            });
          }}
        >
          <div className="grid grid-cols-[8rem_1fr] gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="np-code">Code</Label>
              <Input
                id="np-code"
                placeholder="COT-001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-title">Title</Label>
              <Input
                id="np-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>
          {create.error && (
            <p role="alert" className="text-sm text-destructive">
              {create.error.message}
            </p>
          )}
          <DialogFooter>
            <Button
              type="submit"
              disabled={create.isPending || !code.trim() || !title.trim()}
            >
              {create.isPending ? "Creating…" : "Create and add items"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProposalsCard({ o }: { o: Detail }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Proposals</h2>
        <NewProposalDialog o={o} />
      </div>
      {o.proposals.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No quote prepared yet.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {o.proposals.map((p) => (
            <li key={p.id} className="py-2">
              <Link
                href={`/crm/proposals/${p.id}`}
                className="group flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium group-hover:text-primary">
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.code}
                    </span>{" "}
                    {p.title}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatMoney(p.total, p.currency)}
                    {p.sentAt ? ` · sent ${formatDate(p.sentAt)}` : ""}
                  </p>
                </div>
                <ProposalStatusBadge status={p.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function OpportunityPage() {
  const { id } = useParams<{ id: string }>();
  const today = localDay();
  const query = trpc.opportunities.get.useQuery({ id }, { retry: false });
  const o = query.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <CrmNav />
      <Link
        href="/crm/pipeline"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Pipeline
      </Link>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !o ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error?.data?.code === "NOT_FOUND"
            ? "This opportunity does not exist."
            : (query.error?.message ?? "Could not load the opportunity.")}
        </p>
      ) : (
        <>
          <header>
            <h1 className="text-2xl font-semibold">{o.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {o.client.name}
              {o.contact ? ` · ${o.contact.name}` : ""}
            </p>
          </header>

          <StageStepper o={o} />

          {o.stage === "LOST" && (
            <p className="rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm">
              <span className="font-medium">Lost</span> on{" "}
              {formatDate(o.closedAt)}
              {o.lostReason ? ` — ${o.lostReason}` : ""}. Pick a stage above to
              reopen it.
            </p>
          )}
          {o.stage === "WON" && (
            <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm">
              <span className="font-medium">Won</span> on{" "}
              {formatDate(o.closedAt)}. Convert the accepted proposal into a
              project from the proposal page.
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-5">
              <ActivityComposer o={o} />
              <div>
                <h2 className="mb-3 text-sm font-semibold">History</h2>
                <Timeline o={o} />
              </div>
            </div>
            <aside className="space-y-4">
              <NextStepCard
                key={`${o.nextAction}|${toDay(o.nextActionAt)}`}
                o={o}
                today={today}
              />
              <ProposalsCard o={o} />
              <DetailsCard o={o} />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
