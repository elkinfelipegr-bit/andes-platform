// Proposal totals are computed, never stored (sprint-4-domain-model.md,
// ratified decision 1). Decimal math end to end — floats never touch money.
import { Prisma } from "@andes/db";

export interface PricedItem {
  quantity: Prisma.Decimal | number | string;
  unitPrice: Prisma.Decimal | number | string;
}

export function proposalTotal(items: PricedItem[]): number {
  return items
    .reduce(
      (acc, item) =>
        acc.add(
          new Prisma.Decimal(item.quantity).mul(
            new Prisma.Decimal(item.unitPrice),
          ),
        ),
      new Prisma.Decimal(0),
    )
    .toNumber();
}
