// Inbound lead intake endpoint (ADR-011). Server-to-server only: the
// public website's server action calls it with a shared bearer key; a
// browser never does. Unconfigured (no key or no tenant) it answers 503
// and accepts nothing.
import { intakeLead, isValidIntakeKey, leadIntakeSchema } from "@andes/api";
import { prisma } from "@andes/db";

export async function POST(req: Request) {
  const key = process.env.LEAD_INTAKE_KEY;
  const tenantId = process.env.LEAD_INTAKE_TENANT_ID;
  if (!key || !tenantId) {
    return Response.json(
      { error: "Lead intake is not configured." },
      { status: 503 },
    );
  }
  if (!isValidIntakeKey(req.headers.get("authorization"), key)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = leadIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid lead.",
        fields: parsed.error.issues.map((i) => i.path.join(".")),
      },
      { status: 400 },
    );
  }

  try {
    const { opportunityId } = await intakeLead(prisma, tenantId, parsed.data);
    return Response.json({ opportunityId }, { status: 201 });
  } catch (e) {
    console.error("[lead-intake] failed", e);
    return Response.json(
      { error: "Could not record the lead." },
      { status: 500 },
    );
  }
}
