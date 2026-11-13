import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@andes/auth";

import { InvitationsSection } from "./_components/invitations-section";
import { MembersSection } from "./_components/members-section";

// Administration (sprint-12.md scope item 3): members + invitations for
// the firm's OWNER_ADMIN. The redirect below is navigation courtesy —
// every admin procedure is roleProcedure("OWNER_ADMIN") on the server.
export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.activeMembership?.roleKey !== "OWNER_ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Administration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who belongs to your firm on the platform, and with which role.
        </p>
      </div>
      <MembersSection currentUserId={session.user.id} />
      <InvitationsSection />
    </div>
  );
}
