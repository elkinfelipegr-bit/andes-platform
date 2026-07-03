import { PrismaClient } from "@prisma/client";

// Singleton to avoid exhausting connections under Next.js hot reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
export { forTenant, forUser, type TenantClient } from "./tenant-client.js";
