"use client";

import { createAuthClient } from "better-auth/react";
import { customSessionClient } from "better-auth/client/plugins";
import type { Auth } from "@andes/auth";

// customSessionClient types the client session with activeMembership.
export const authClient = createAuthClient({
  plugins: [customSessionClient<Auth>()],
});
