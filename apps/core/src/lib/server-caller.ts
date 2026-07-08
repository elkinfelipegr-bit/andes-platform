// Server-side tRPC caller for React Server Components: same procedures,
// same middleware chain — no HTTP hop (ADR-003 stays the single API layer).
import { headers } from "next/headers";

import { appRouter, createCallerFactory, createContext } from "@andes/api";

const createCaller = createCallerFactory(appRouter);

export async function serverCaller() {
  const h = await headers();
  const ctx = await createContext(
    new Request("http://internal", { headers: h }),
  );
  return createCaller(ctx);
}
