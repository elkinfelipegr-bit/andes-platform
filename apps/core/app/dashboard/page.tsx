import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@andes/auth";

import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const membership = session.activeMembership;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Andes Core</h1>
        <SignOutButton />
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Session
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">User</dt>
            <dd>
              {session.user.name} ({session.user.email})
            </dd>
          </div>
          {membership ? (
            <>
              <div className="flex justify-between">
                <dt className="text-slate-500">Tenant</dt>
                <dd>{membership.tenantSlug}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Role</dt>
                <dd className="font-medium">{membership.roleLabel}</dd>
              </div>
            </>
          ) : (
            <p className="rounded-md bg-amber-50 p-3 text-amber-800">
              You are signed in but not a member of any tenant yet. Ask an
              operator to run{" "}
              <code className="font-mono text-xs">
                pnpm --filter @andes/db link-member {session.user.email}
              </code>
            </p>
          )}
        </dl>
      </section>
    </main>
  );
}
