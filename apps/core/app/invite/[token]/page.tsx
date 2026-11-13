import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@andes/auth";

import { AppProviders } from "../../(app)/providers";
import { AcceptInvitation } from "./accept-invitation";

// Public invitation landing (sprint-12.md scope item 3). Lives outside
// the (app) shell on purpose: the visitor usually has no account yet, so
// "no session" must route through /login and come back here — the shell
// layout would drop the token on its way to /login.
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AppProviders>
        <AcceptInvitation token={token} signedInEmail={session.user.email} />
      </AppProviders>
    </main>
  );
}
