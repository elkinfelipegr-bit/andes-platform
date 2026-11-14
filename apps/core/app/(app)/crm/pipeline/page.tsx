"use client";

// CRM pipeline — sprint-15.md scope item 3. Three views of one read
// (opportunities.list): the follow-up agenda, the stage board, and the
// closed list. Sent proposals awaiting an answer join the agenda.
import {
  CircleCheck,
  CircleX,
  FileText,
  MoreHorizontal,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type DragEvent } from "react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  cn,
} from "@andes/ui";

import {
  daysBetween,
  formatDate,
  formatMoney,
  formatMoneyCompact,
  localDay,
  relativeDay,
  toDay,
} from "@/lib/format";
import { trpc } from "@/lib/trpc";

import { CrmNav } from "../_components/crm-nav";
import { FollowUpChip } from "./_components/follow-up-chip";
import { LostDialog } from "./_components/lost-dialog";
import { NewOpportunityDialog } from "./_components/opportunity-dialog";
import {
  OPEN_STAGES,
  STAGE_HINT,
  STAGE_LABEL,
  isOpen,
  sumByCurrency,
  type Opportunity,
  type Stage,
} from "./_components/pipeline-meta";

function moneyTotals(rows: Opportunity[], compact = true) {
  const totals = sumByCurrency(rows);
  if (totals.length === 0) return "—";
  return totals
    .map((t) =>
      compact
        ? formatMoneyCompact(t.value, t.currency)
        : formatMoney(t.value, t.currency),
    )
    .join(" · ");
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "alert";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "alert" && "text-destructive",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function OpportunityCard({
  opportunity,
  today,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  opportunity: Opportunity;
  today: string;
  onMove: (stage: Stage) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const o = opportunity;
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", o.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="group relative cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/crm/pipeline/${o.id}`}
          className="text-sm leading-snug font-medium after:absolute after:inset-0 hover:text-primary focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {o.title}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Move “${o.title}”`}
              className="relative z-10 -mt-1 -mr-1 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {OPEN_STAGES.filter((s) => s !== o.stage).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onMove(s)}>
                {STAGE_LABEL[s]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onMove("WON")}>
              Mark as won
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onMove("LOST")}>
              Mark as lost…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        {o.client.name}
      </p>
      {o.nextAction && (
        <p className="mt-2 line-clamp-2 text-xs text-foreground/80">
          → {o.nextAction}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        {o.followUp && (
          <FollowUpChip
            state={o.followUp}
            nextActionAt={o.nextActionAt}
            today={today}
          />
        )}
        <span className="ml-auto text-xs font-medium tabular-nums">
          {o.estimatedValue !== null
            ? formatMoneyCompact(o.estimatedValue, o.currency)
            : ""}
        </span>
      </div>
      {o._count.proposals > 0 && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <FileText aria-hidden="true" className="size-3" />
          {o._count.proposals === 1
            ? "1 proposal"
            : `${o._count.proposals} proposals`}
        </p>
      )}
    </article>
  );
}

export default function PipelinePage() {
  const today = localDay();
  const utils = trpc.useUtils();
  const list = trpc.opportunities.list.useQuery({ today });
  const sent = trpc.proposals.list.useQuery({ status: "SENT" });
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState<Stage | null>(null);
  const [losing, setLosing] = useState<Opportunity | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const setStage = trpc.opportunities.setStage.useMutation({
    // Optimistic: the card lands where it was dropped at once.
    onMutate: async ({ id, stage }) => {
      await utils.opportunities.list.cancel();
      const previous = utils.opportunities.list.getData({ today });
      utils.opportunities.list.setData({ today }, (rows) =>
        rows?.map((o) => (o.id === id ? { ...o, stage } : o)),
      );
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) {
        utils.opportunities.list.setData({ today }, context.previous);
      }
    },
    onSettled: () => {
      void utils.opportunities.list.invalidate();
      setLosing(null);
    },
  });

  const all = useMemo(() => list.data ?? [], [list.data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((o) =>
      `${o.title} ${o.client.name} ${o.nextAction ?? ""} ${o.owner.name}`
        .toLowerCase()
        .includes(q),
    );
  }, [all, query]);

  const open = all.filter((o) => isOpen(o.stage));
  const due = open.filter(
    (o) => o.followUp === "OVERDUE" || o.followUp === "TODAY",
  );
  const unplanned = open.filter((o) => o.followUp === "NONE");
  const upcoming = open.filter((o) => o.followUp === "UPCOMING");
  const closed = filtered
    .filter((o) => !isOpen(o.stage))
    .sort((a, b) => (toDay(b.closedAt) > toDay(a.closedAt) ? 1 : -1));
  const awaiting = sent.data ?? [];
  const awaitingTotal = awaiting.reduce((sum, p) => sum + p.total, 0);

  function move(o: Opportunity, stage: Stage) {
    if (stage === o.stage) return;
    if (stage === "LOST") setLosing(o);
    else setStage.mutate({ id: o.id, stage });
  }

  function dropOn(stage: Stage) {
    return {
      onDragOver: (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(stage);
      },
      onDragLeave: () => setOver((s) => (s === stage ? null : s)),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        const o = all.find((x) => x.id === id);
        setOver(null);
        setDragging(false);
        if (o) move(o, stage);
      },
    };
  }

  const agenda = [...due, ...unplanned];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <CrmNav />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every prospect, what was last said, and what happens next.
          </p>
        </div>
        <NewOpportunityDialog />
      </div>

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading pipeline…</p>
      ) : list.error ? (
        <p role="alert" className="text-sm text-destructive">
          {list.error.message}
        </p>
      ) : all.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="font-medium">No opportunities yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Add the prospects you are talking to and the quotes you are waiting
            on. Each one gets a next step with a date, so nothing is forgotten.
          </p>
          <div className="mt-4 flex justify-center">
            <NewOpportunityDialog />
          </div>
        </div>
      ) : (
        <>
          <section
            aria-label="Summary"
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            <Tile
              label="Open opportunities"
              value={String(open.length)}
              hint={`${closed.filter((o) => o.stage === "WON").length} won · ${closed.filter((o) => o.stage === "LOST").length} lost`}
            />
            <Tile
              label="Open pipeline value"
              value={moneyTotals(open)}
              hint="Sum of estimated values"
            />
            <Tile
              label="Follow-ups due"
              value={String(due.length)}
              tone={
                due.some((o) => o.followUp === "OVERDUE") ? "alert" : undefined
              }
              hint={
                unplanned.length > 0
                  ? `${unplanned.length} more without a next step`
                  : "Overdue or due today"
              }
            />
            <Tile
              label="Quotes awaiting answer"
              value={String(awaiting.length)}
              hint={
                awaiting.length > 0
                  ? formatMoneyCompact(
                      awaitingTotal,
                      awaiting[0]?.currency ?? "COP",
                    )
                  : "No sent proposals pending"
              }
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card">
              <header className="flex items-baseline justify-between border-b border-border px-4 py-3">
                <h2 className="font-semibold">Follow up now</h2>
                <span className="text-xs text-muted-foreground">
                  {upcoming.length > 0
                    ? `${upcoming.length} more in the next 7 days`
                    : ""}
                </span>
              </header>
              {agenda.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  Nothing due. Every open opportunity has a next step scheduled.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {agenda.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/crm/pipeline/${o.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {o.nextAction ?? "Decide the next step"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {o.client.name} · {o.title}
                          </p>
                        </div>
                        {o.followUp && (
                          <FollowUpChip
                            state={o.followUp}
                            nextActionAt={o.nextActionAt}
                            today={today}
                          />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card">
              <header className="flex items-baseline justify-between border-b border-border px-4 py-3">
                <h2 className="font-semibold">Quotes awaiting answer</h2>
                <Link
                  href="/crm/proposals"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                >
                  All proposals
                </Link>
              </header>
              {awaiting.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  No sent proposals are waiting for a decision.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {awaiting.map((p) => {
                    const waited = p.sentAt
                      ? daysBetween(toDay(p.sentAt), today)
                      : null;
                    const expires = p.validUntil
                      ? daysBetween(today, toDay(p.validUntil))
                      : null;
                    return (
                      <li key={p.id}>
                        <Link
                          href={
                            p.opportunityId
                              ? `/crm/pipeline/${p.opportunityId}`
                              : `/crm/proposals/${p.id}`
                          }
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              <span className="font-mono text-xs text-muted-foreground">
                                {p.code}
                              </span>{" "}
                              {p.title}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {p.client.name} ·{" "}
                              {waited === null
                                ? "sent date not recorded"
                                : waited === 0
                                  ? "sent today"
                                  : `sent ${waited} ${waited === 1 ? "day" : "days"} ago`}
                              {expires !== null &&
                                (expires < 0
                                  ? " · validity expired"
                                  : ` · valid ${relativeDay(toDay(p.validUntil), today).toLowerCase()}`)}
                            </p>
                          </div>
                          <span className="text-sm font-medium tabular-nums">
                            {formatMoneyCompact(p.total, p.currency)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section aria-label="Board" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Board</h2>
              <div className="relative w-full max-w-xs">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground"
                />
                <Input
                  type="search"
                  aria-label="Search opportunities"
                  placeholder="Search client, need or next step"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="-mx-8 overflow-x-auto px-8 pb-2">
              <div className="grid min-w-[56rem] grid-cols-4 gap-3">
                {OPEN_STAGES.map((stage) => {
                  const cards = filtered.filter((o) => o.stage === stage);
                  return (
                    <div
                      key={stage}
                      {...dropOn(stage)}
                      className={cn(
                        "flex min-h-48 flex-col rounded-xl bg-muted/70 p-2 transition-colors",
                        over === stage && "bg-primary/10 ring-2 ring-primary",
                      )}
                    >
                      <header
                        className="px-1.5 pt-1 pb-2"
                        title={STAGE_HINT[stage]}
                      >
                        <div className="flex items-baseline justify-between">
                          <h3 className="text-sm font-semibold">
                            {STAGE_LABEL[stage]}
                            <span className="ml-1.5 font-normal text-muted-foreground">
                              {cards.length}
                            </span>
                          </h3>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {moneyTotals(cards)}
                          </span>
                        </div>
                      </header>
                      <div className="flex flex-1 flex-col gap-2">
                        {cards.map((o) => (
                          <OpportunityCard
                            key={o.id}
                            opportunity={o}
                            today={today}
                            onMove={(s) => move(o, s)}
                            onDragStart={() => setDragging(true)}
                            onDragEnd={() => {
                              setDragging(false);
                              setOver(null);
                            }}
                          />
                        ))}
                        {cards.length === 0 && (
                          <p className="px-1.5 py-4 text-xs text-muted-foreground">
                            {query ? "No matches" : STAGE_HINT[stage]}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className={cn(
                "grid grid-cols-2 gap-3 transition-opacity",
                dragging ? "opacity-100" : "opacity-70",
              )}
            >
              {(["WON", "LOST"] as const).map((stage) => (
                <div
                  key={stage}
                  {...dropOn(stage)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground",
                    over === stage &&
                      (stage === "WON"
                        ? "border-success bg-success/10 text-foreground"
                        : "border-destructive bg-destructive/10 text-foreground"),
                  )}
                >
                  {stage === "WON" ? (
                    <CircleCheck aria-hidden="true" className="size-4" />
                  ) : (
                    <CircleX aria-hidden="true" className="size-4" />
                  )}
                  Drop here to mark as {STAGE_LABEL[stage].toLowerCase()}
                </div>
              ))}
            </div>
            {setStage.error && (
              <p role="alert" className="text-sm text-destructive">
                {setStage.error.message}
              </p>
            )}
          </section>

          {closed.length > 0 && (
            <section className="space-y-3">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={showClosed}
                onClick={() => setShowClosed((v) => !v)}
              >
                {showClosed ? "Hide" : "Show"} closed ({closed.length})
              </Button>
              {showClosed && (
                <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                  {closed.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/crm/pipeline/${o.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                      >
                        {o.stage === "WON" ? (
                          <CircleCheck
                            aria-hidden="true"
                            className="size-4 shrink-0 text-success"
                          />
                        ) : (
                          <CircleX
                            aria-hidden="true"
                            className="size-4 shrink-0 text-muted-foreground"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {o.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {o.client.name} · {STAGE_LABEL[o.stage]}{" "}
                            {formatDate(o.closedAt)}
                            {o.lostReason ? ` · ${o.lostReason}` : ""}
                          </p>
                        </div>
                        <span className="text-sm tabular-nums">
                          {o.estimatedValue !== null
                            ? formatMoneyCompact(o.estimatedValue, o.currency)
                            : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <LostDialog
        key={losing?.id ?? "none"}
        title={losing?.title ?? ""}
        open={!!losing}
        busy={setStage.isPending}
        error={setStage.error?.message ?? null}
        onCancel={() => setLosing(null)}
        onConfirm={(lostReason) =>
          losing &&
          setStage.mutate({ id: losing.id, stage: "LOST", lostReason })
        }
      />
    </div>
  );
}
