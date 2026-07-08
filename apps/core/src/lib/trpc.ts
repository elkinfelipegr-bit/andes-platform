"use client";

// Frontend tRPC client (ADR-003) on TanStack Query (ADR-001 state layer).
// Server components use a direct caller instead (src/lib/server-caller.ts).
import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@andes/api";

export const trpc = createTRPCReact<AppRouter>();

export type RouterOutputs = inferRouterOutputs<AppRouter>;
