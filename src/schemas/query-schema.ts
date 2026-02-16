import { z } from "zod";

export const QuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(1000).default(25),
    updated_after: z.string().datetime().optional(),
    updated_before: z.string().datetime().optional(),
  });

export const DefaultQuerySchemaRefined = QuerySchema.refine(
    (q) =>
      !q.updated_after ||
      !q.updated_before ||
      new Date(q.updated_after) <= new Date(q.updated_before),
    { message: "'updated_after' must be <= 'updated_before'" }
  );

export function withDefaultQuerySchema<T extends z.ZodType>(schema: T) {
  return schema.and(DefaultQuerySchemaRefined);
}

export function querySchemaToRange(
  schema: Pick<z.infer<typeof QuerySchema>, "page" | "limit">
) {
  const { page, limit } = schema;

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  return { from, to };
}
