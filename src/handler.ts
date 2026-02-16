import { z, ZodError, ZodType } from "zod";
import { Forbidden, HttpError } from "./errors";
import { httpError } from "./responses";
import { InferOrUnknown, validateWithSchema } from "./validation";
import { Guard } from "./guard";

export type Schemas = {
  paramsSchema?: ZodType;
  querySchema?: ZodType;
  bodySchema?: ZodType;
};

function formDataToObject(fd: FormData) {
  const obj: Record<string, any> = {};
  for (const key of fd.keys()) {
    const all = fd.getAll(key);
    obj[key] = all.length > 1 ? all : all[0];
  }
  return obj;
}

type RouteContext = {
  params?: Promise<Record<string, string | string[]>>;
};

export interface RouteHandlerWithMetadata {
  (req: Request, ctx: RouteContext): Promise<Response>;
  _schemas?: Schemas;
  _guard?: Guard<any, any, any>;
}

export function handleRoute<T extends string, R, A, O extends Schemas>(
  fn: (ctx: {
    req: Request;
    params: InferOrUnknown<O["paramsSchema"]>;
    query: InferOrUnknown<O["querySchema"]>;
    body: O["bodySchema"] extends ZodType
      ? z.infer<O["bodySchema"]>
      : undefined;
    handleResourcePermission: (resource: R) => void;
    authData?: A;
  }) => Promise<Response>,
  schemas?: O,
  guard?: Guard<T, R, A>
) {
  const handler: RouteHandlerWithMetadata = async (
    req: Request,
    ctx: RouteContext
  ): Promise<Response> => {
    let handleResourcePermission: (resource: R) => void = (resource) => {};
    let authData: A | undefined = undefined;
    if (guard) {
      const permissionHandler = await guard.permissionHandlerGenerator(
        guard.action,
        req
      );
      authData = permissionHandler.authData;
      if (!permissionHandler.needResource) {
        const authorized = permissionHandler.handler();
        if (!authorized) return httpError(403, "Forbidden");
      } else {
        handleResourcePermission = (resource: R) => {
          const authorized = permissionHandler.handler(resource);
          if (!authorized) throw new Forbidden();
        };
      }
    }
    try {
      const invalidatedParams = await ctx.params;
      let paramsValue: unknown = invalidatedParams ?? {};
      if (schemas?.paramsSchema) {
        const validated = validateWithSchema(
          schemas.paramsSchema,
          invalidatedParams,
          "parameters"
        );
        if (validated instanceof Response) return validated;
        paramsValue = validated;
      }

      let queryValue: unknown = {};
      if (schemas?.querySchema) {
        const rawQuery = Object.fromEntries(
          new URL(req.url).searchParams.entries()
        );
        const validated = validateWithSchema(
          schemas.querySchema,
          rawQuery,
          "query"
        );
        if (validated instanceof Response) return validated;
        queryValue = validated;
      }

      let bodyValue: unknown = undefined;
      if (schemas?.bodySchema) {
        const contentType = req.headers.get("content-type") ?? "";
        let rawBody: unknown;

        try {
          if (contentType.startsWith("multipart/form-data")) {
            const fd = await req.formData();
            rawBody = formDataToObject(fd);
          } else if (
            contentType.includes("application/json") ||
            contentType === ""
          ) {
            rawBody = await req.json();
          } else {
            return Response.json(
              { error: `Unsupported Content-Type: ${contentType}` },
              { status: 415 }
            );
          }
        } catch {
          return Response.json(
            { error: "Invalid request body" },
            { status: 400 }
          );
        }

        const validated = validateWithSchema(
          schemas.bodySchema,
          rawBody,
          "body"
        );
        if (validated instanceof Response) return validated;
        bodyValue = validated;
      }

      return await fn({
        req,
        params: paramsValue as InferOrUnknown<O["paramsSchema"]>,
        query: queryValue as InferOrUnknown<O["querySchema"]>,
        body: bodyValue as O["bodySchema"] extends ZodType
          ? z.infer<O["bodySchema"]>
          : undefined,
        handleResourcePermission,
        authData,
      });
    } catch (e: unknown) {
      if (e instanceof ZodError)
        return Response.json(
          { error: "Validation error", issues: e.issues },
          { status: 400 }
        );
      if (e instanceof HttpError) return httpError(e.status, e.message);
      // eslint-disable-next-line no-console
      console.error(e);
      return httpError(500, "Internal server error");
    }
  };

  handler._schemas = schemas; // useful for generating docs later
  handler._guard = guard;

  return handler;
}
