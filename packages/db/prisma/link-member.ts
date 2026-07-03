// Sprint 0 provisioning: attach an already-signed-up user to a tenant with a
// role. Runs as the admin DB identity (bypasses RLS) — this is deliberate:
// membership provisioning is an operator action until an invite flow exists.
//
// Usage: pnpm --filter @andes/db link-member <email> [ROLE_KEY] [tenant-slug]
//        ROLE_KEY defaults to OWNER_ADMIN, tenant-slug to andes-engineering.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const [email, roleKey = "OWNER_ADMIN", tenantSlug = "andes-engineering"] =
  process.argv.slice(2);

async function main() {
  if (!email) {
    throw new Error(
      "Usage: pnpm --filter @andes/db link-member <email> [ROLE_KEY] [tenant-slug]",
    );
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user)
    throw new Error(`No user with email ${email} — sign up in the app first.`);

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (!tenant)
    throw new Error(`No tenant with slug ${tenantSlug} — run the seed.`);

  const role = await prisma.role.findUnique({
    where: { tenantId_key: { tenantId: tenant.id, key: roleKey } },
  });
  if (!role) throw new Error(`No role ${roleKey} in tenant ${tenantSlug}.`);

  const membership = await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { roleId: role.id },
    create: { tenantId: tenant.id, userId: user.id, roleId: role.id },
  });

  console.log(
    `${email} → ${tenant.slug} as ${roleKey} (membership ${membership.id})`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
