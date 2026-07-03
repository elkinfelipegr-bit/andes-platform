// Sprint 0 seed — RFC-001: "Seed/dev data must include at least one seed
// tenant record representing Andes Engineering itself" (Tenant #1).
// Seed roles per sprint-0-domain-model.md: OWNER_ADMIN, ENGINEER.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const andes = await prisma.tenant.upsert({
    where: { slug: "andes-engineering" },
    update: {},
    create: {
      name: "Andes Engineering",
      slug: "andes-engineering",
    },
  });

  const seedRoles = [
    { key: "OWNER_ADMIN", label: "Owner / Admin" },
    { key: "ENGINEER", label: "Engineer" },
  ];

  for (const role of seedRoles) {
    await prisma.role.upsert({
      where: { tenantId_key: { tenantId: andes.id, key: role.key } },
      update: { label: role.label },
      create: { tenantId: andes.id, ...role },
    });
  }

  console.log(`Seeded tenant "${andes.name}" (${andes.slug}) with roles: ${seedRoles.map((r) => r.key).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
