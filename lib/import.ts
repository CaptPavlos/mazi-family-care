import { z } from "zod";
import { conditionSchema, both, type Condition } from "./model";
const fhir = z.object({
  resourceType: z.literal("Bundle"),
  entry: z.array(z.object({ resource: z.unknown().optional() })).max(5000),
});
export function parseImport(raw: unknown): Condition[] {
  if (raw && typeof raw === "object" && "conditions" in raw) {
    const list = z
      .array(conditionSchema)
      .max(500)
      .parse((raw as { conditions: unknown }).conditions);
    return list.map((c) => ({ ...c, verified: false }));
  }
  const bundle = fhir.parse(raw);
  const result: Condition[] = [];
  for (const item of bundle.entry) {
    const r = item.resource as Record<string, unknown> | undefined;
    if (!r || r.resourceType !== "Condition") continue;
    const c = z
      .object({
        resourceType: z.literal("Condition"),
        id: z.string().min(1).max(120),
        code: z
          .object({
            text: z.string().optional(),
            coding: z
              .array(z.object({ display: z.string().optional() }))
              .optional(),
          })
          .optional(),
        onsetDateTime: z.string().optional(),
        recordedDate: z.string().optional(),
        note: z.array(z.object({ text: z.string() })).optional(),
      })
      .passthrough()
      .parse(r);
    const title =
      c.code?.text || c.code?.coding?.find((v) => v.display)?.display;
    if (!title) continue;
    // Do not infer severity, laterality, diagnosis, or treatment from free text.
    const rawDate = (c.onsetDateTime || c.recordedDate || "").slice(0, 10);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : "";
    result.push(
      conditionSchema.parse({
        id: `fhir-${c.id}`,
        title: both(title),
        region: "body",
        status: "unknown",
        detail: both(c.note?.map((n) => n.text).join("\n") || ""),
        date,
        source: "document",
        sourceId: c.id,
        verified: false,
      }),
    );
  }
  return result;
}
