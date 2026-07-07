import { headers } from "next/headers";
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

import { moduleNav } from "../_components/nav-items";

// Dashboard frame (docs/sprints/sprint-1.md scope item 3): limited to what
// the domain already supports — session identity, tenant, role — plus the
// module map as placeholders. Real widgets arrive with their domains.
export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const membership = session.activeMembership;
  const firstName = session.user.name.split(" ")[0] ?? session.user.name;

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
