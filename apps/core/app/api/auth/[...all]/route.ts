// Better Auth handler (ADR-002) — all /api/auth/* endpoints.
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@andes/auth";

export const { GET, POST } = toNextJsHandler(auth.handler);
