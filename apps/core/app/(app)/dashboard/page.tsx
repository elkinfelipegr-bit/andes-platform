import {
  Boxes,
  Building2,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Handshake,
  Mountain,
  Sparkles,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@andes/auth";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@andes/ui";

import { serverCaller } from "@/lib/server-caller";

import { moduleNav } from "../_components/nav-items";

// Dashboard (sprint-1.md frame + sprint-2.md scope item 3): session
// identity, tenant, role — and the first real widget, the active-projects
// count, now that the Projects domain exists.
export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const membership = session.activeMembership;
  const firstName = session.user.name.split(" ")[0] ?? session.user.name;

  let activeProjectCount: number | null = null;
  let activeClientCount: number | null = null;
  let pendingProposalCount: number | null = null;
  let scheduledInspectionCount: number | null = null;
  let draftCalcRecordCount: number | null = null;
  let draftGeoRecordCount: number | null = null;
  let bimModelCount: number | null = null;
  let aiConversationCount: number | null = null;
  if (membership) {
    const caller = await serverCaller();
    const [
      activeProjects,
      activeClients,
      sentProposals,
      scheduled,
      drafts,
      geoDrafts,
      bimModels,
      aiConversations,
    ] = await Promise.all([
      caller.projects.list({ status: "ACTIVE" }),
      caller.clients.list(),
      caller.proposals.list({ status: "SENT" }),
      caller.inspections.list({ status: "SCHEDULED" }),
      caller.calcRecords.list({ status: "DRAFT" }),
      caller.geoRecords.list({ status: "DRAFT" }),
      caller.bimModels.list(),
      caller.ai.listConversations(),
    ]);
    activeProjectCount = activeProjects.length;
    activeClientCount = activeClients.length;
    pendingProposalCount = sentProposals.length;
    scheduledInspectionCount = scheduled.length;
    draftCalcRecordCount = drafts.length;
    draftGeoRecordCount = geoDrafts.length;
    bimModelCount = bimModels.length;
    aiConversationCount = aiConversations.length;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {membership
            ? "Your workspace at a glance."
            : "Your account is not linked to a tenant yet."}
        </p>
      </div>

      {membership ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Signed in as</CardDescription>
              <CardTitle className="text-base">{session.user.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-xs text-muted-foreground">
                {session.user.email}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Tenant</CardDescription>
              <CardTitle className="text-base">
                {membership.tenantSlug}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-xs text-muted-foreground">
                {membership.tenantId}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Role</CardDescription>
              <CardTitle className="text-base">
                {membership.roleLabel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="font-mono text-[11px]">
                {membership.roleKey}
              </Badge>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-base">No tenant membership</CardTitle>
            <CardDescription>
              You are signed in but not a member of any tenant yet. Ask an
              operator to run:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
              pnpm --filter @andes/db link-member {session.user.email}
            </code>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Modules
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {membership && (
            <>
              <Link href="/projects" className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardHeader>
                    <FolderKanban
                      className="size-5 text-primary"
                      aria-hidden="true"
                    />
                    <CardTitle className="text-sm">Projects</CardTitle>
                    <CardDescription>
                      <span className="text-2xl font-semibold text-foreground">
                        {activeProjectCount}
                      </span>{" "}
                      active
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              <Link href="/crm" className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardHeader>
                    <Handshake
                      className="size-5 text-primary"
                      aria-hidden="true"
                    />
                    <CardTitle className="text-sm">CRM</CardTitle>
                    <CardDescription>
                      <span className="text-2xl font-semibold text-foreground">
                        {activeClientCount}
                      </span>{" "}
                      clients
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              <Link href="/crm/proposals" className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardHeader>
                    <FileText
                      className="size-5 text-primary"
                      aria-hidden="true"
                    />
                    <CardTitle className="text-sm">Proposals</CardTitle>
                    <CardDescription>
                      <span className="text-2xl font-semibold text-foreground">
                        {pendingProposalCount}
                      </span>{" "}
                      awaiting decision
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              <Link href="/projects/inspections" className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardHeader>
                    <ClipboardCheck
                      className="size-5 text-primary"
                      aria-hidden="true"
                    />
                    <CardTitle className="text-sm">Inspections</CardTitle>
                    <CardDescription>
                      <span className="text-2xl font-semibold text-foreground">
                        {scheduledInspectionCount}
                      </span>{" "}
                      scheduled
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              <Link href="/structures" className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardHeader>
                    <Building2
                      className="size-5 text-primary"
                      aria-hidden="true"
                    />
                    <CardTitle className="text-sm">Structures</CardTitle>
                    <CardDescription>
                      <span className="text-2xl font-semibold text-foreground">
                        {draftCalcRecordCount}
                      </span>{" "}
                      draft records
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              <Link href="/geo" className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardHeader>
                    <Mountain
                      className="size-5 text-primary"
                      aria-hidden="true"
                    />
                    <CardTitle className="text-sm">Geo</CardTitle>
                    <CardDescription>
                      <span className="text-2xl font-semibold text-foreground">
                        {draftGeoRecordCount}
                      </span>{" "}
                      draft records
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              <Link href="/bim" className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardHeader>
                    <Boxes className="size-5 text-primary" aria-hidden="true" />
                    <CardTitle className="text-sm">BIM</CardTitle>
                    <CardDescription>
                      <span className="text-2xl font-semibold text-foreground">
                        {bimModelCount}
                      </span>{" "}
                      models
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              <Link href="/ai" className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardHeader>
                    <Sparkles
                      className="size-5 text-primary"
                      aria-hidden="true"
                    />
                    <CardTitle className="text-sm">AI</CardTitle>
                    <CardDescription>
                      <span className="text-2xl font-semibold text-foreground">
                        {aiConversationCount}
                      </span>{" "}
                      conversations
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </>
          )}
          {moduleNav
            .filter((item) => !item.enabled)
            .map((item) => (
              <Card key={item.href} className="opacity-70">
                <CardHeader>
                  <item.icon
                    className="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <CardTitle className="text-sm">{item.label}</CardTitle>
                  <CardDescription>
                    <Badge variant="muted">Soon</Badge>
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
        </div>
      </section>
    </div>
  );
}
