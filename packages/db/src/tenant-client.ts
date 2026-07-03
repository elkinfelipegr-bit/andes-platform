import { PrismaClient } from "@prisma/client";

// RFC-001 layer 2 hookup: returns a client whose every query runs inside a
// transaction that first sets `app.tenant_id`, so the RLS policies in
// prisma/sql/rls.sql apply. set_config(..., true) is transaction-local
// (SET LOCAL semantics), so pooled connections never leak a tenant id.
//
// This is the backstop, not the primary isolation: procedures must still
// filter by tenantId explicitly (RFC-001 layer 1, enforced by the tRPC
// middleware in @andes/api).
export function forTenant(prisma: PrismaClient, tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof forTenant>;
