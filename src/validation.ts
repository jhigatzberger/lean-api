import z, { ZodType } from "zod";

export type InferOrUnknown<T> = T extends ZodType ? z.infer<T> : unknown;

export function validateWithSchema<S extends ZodType>(
  schema: S,
  value: unknown,
  kind: "parameters" | "query" | "body"
): z.infer<S> | Response {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  return Response.json(
    { error: `Invalid ${kind}`, issues: parsed.error.issues },
    { status: 400 }
  );
}
