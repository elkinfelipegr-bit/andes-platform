import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@andes/auth";

import { Sidebar } from "./_components/sidebar";
import { Topbar } from "./_components/topbar";
import { AppProviders } from "./providers";

// Authenticated shell (docs/design/navigation.md): every product page
// renders inside this layout. Access states: no session → /login; no
// membership → shell with navigation disabled, page decides its body.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const membership = session.activeMembership;

  return (
    <div className="flex min-h-screen">
      <Sidebar navDisabled={!membership} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={{ name: session.user.name, email: session.user.email }}
          membership={
            membership
              ? {
                  tenantSlug: membership.tenantSlug,
                  roleLabel: membership.roleLabel,
                }
              : null
          }
        />
        <main className="flex-1 p-8 print:p-0">
          <AppProviders>{children}</AppProviders>
        </main>
      </div>
    </div>
  );
}
