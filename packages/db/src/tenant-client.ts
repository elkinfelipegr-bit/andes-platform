import { PrismaClient } from "@prisma/client";

// RFC-001 layer 2 hookups. The RLS policies (see prisma/migrations, the
// rls_policies migration) key off two transaction-local settings:
//   app.tenant_id — normal tenant-scoped work (set by forTenant)
//   app.user_id   — session bootstrap only (set by forUser): a user must be
//                   able to read their OWN memberships before any tenant
//                   context exists, or login could never resolve a tenant.
// set_config(..., TRUE) is SET LOCAL semantics: scoped to the wrapping
// transaction, so pooled connections never leak an identity.
//
// These are the backstop, not the primary isolation: procedures must still
// filter by tenantId explicitly (RFC-001 layer 1, enforced by the tRPC
// middleware in @andes/api).

function withSetting(prisma: PrismaClient, key: string, value: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config(${key}, ${value}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export function forTenant(prisma: PrismaClient, tenantId: string) {
  return withSetting(prisma, "app.tenant_id", tenantId);
}

// Only for pre-tenant session bootstrap (@andes/auth getActiveMembership).
// Grants visibility of the user's own membership rows and, through them,
// their role rows — nothing else.
export function forUser(prisma: PrismaClient, userId: string) {
  return withSetting(prisma, "app.user_id", userId);
}

export type TenantClient = ReturnType<typeof forTenant>;
