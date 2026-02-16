import z from "zod";

export const NumericalIdSchema = z.object({
  id: z.coerce.number().int({ message: "Invalid id" }),
});

export const IdSchema = z.object({
  id: z.string(),
});
