# @workspace/api

A type-safe, lightweight API handler library for TypeScript that provides Zod validation, authentication guards, and response helpers for building robust REST APIs.

## Features

- 🔒 **Type-safe route handlers** with full TypeScript inference
- ✅ **Zod schema validation** for params, query strings, and request bodies
- 🛡️ **Authentication & authorization guards** with support for resource-based permissions
- 📦 **Response helpers** for common HTTP responses (OK, Created, Deleted, Error)
- 📄 **Pagination support** with built-in pagination helpers
- 📥 **File download helpers** with proper Content-Disposition headers
- 🚨 **Error handling** with custom HTTP error classes
- 🔄 **Form data support** for multipart/form-data requests

## Installation

```bash
npm install zod
# or
pnpm add zod
```

This package requires `zod` as a peer dependency.

## Quick Start

```typescript
import { handleRoute, httpOk } from "@workspace/api";

export const GET = handleRoute(async ({ req }) => {
  return httpOk({ message: "Hello, World!" });
});
```

## Usage Examples

### Basic Route Handler

The simplest route handler without any validation:

```typescript
import { handleRoute, httpOk } from "@workspace/api";

export const GET = handleRoute(async ({ req }) => {
  const data = { message: "Success" };
  return httpOk(data);
});
```

### Route with Parameter Validation

Validate route parameters using `IdSchema` or `NumericalIdSchema`:

```typescript
// Route: /api/users/[id] or /api/users/<id>
import { handleRoute, httpOk, httpError, IdSchema } from "@workspace/api";

export const GET = handleRoute(
  async ({ params }) => {
    const { id } = params; // TypeScript knows this is { id: string }
    
    // Fetch resource by id
    const resource = await findById(id);
    
    if (!resource) {
      return httpError(404, "Resource not found");
    }
    
    return httpOk(resource);
  },
  { paramsSchema: IdSchema }
);
```

For numeric IDs:

```typescript
// Route: /api/users/[id] or /api/users/<id>
import { handleRoute, NumericalIdSchema } from "@workspace/api";

export const GET = handleRoute(
  async ({ params }) => {
    const { id } = params; // TypeScript knows this is { id: number }
    // ...
  },
  { paramsSchema: NumericalIdSchema }
);
```

### Route with Query Parameter Validation

Use `QuerySchema` for pagination and filtering:

```typescript
import { handleRoute, httpOkPage, QuerySchema, querySchemaToRange } from "@workspace/api";

export const GET = handleRoute(
  async ({ query }) => {
    const { page, limit, updated_after, updated_before } = query;
    // TypeScript knows: page: number, limit: number, updated_after?: string, etc.
    
    const { from, to } = querySchemaToRange({ page, limit });
    
    const { data, total } = await fetchPaginated({
      from,
      to,
      updatedAfter: updated_after,
      updatedBefore: updated_before,
    });
    
    return httpOkPage(data, total, page, limit);
  },
  { querySchema: QuerySchema }
);
```

### Extending the Default Query Schema

Extend the default query schema with custom query parameters using `withDefaultQuerySchema`:

```typescript
import { z } from "zod";
import { handleRoute, httpOkPage, withDefaultQuerySchema, querySchemaToRange } from "@workspace/api";

// Define your custom query parameters
const OrderQuerySchema = z.object({
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
});

// Combine with default pagination and date filtering
const ExtendedQuerySchema = withDefaultQuerySchema(OrderQuerySchema);

export const GET = handleRoute(
  async ({ query }) => {
    // TypeScript knows all fields: page, limit, updated_after, updated_before, 
    // status, minAmount, maxAmount
    const { page, limit, status, minAmount, maxAmount } = query;
    
    const { from, to } = querySchemaToRange({ page, limit });
    
    const { data, total } = await fetchOrders({
      from,
      to,
      status,
      minAmount,
      maxAmount,
    });
    
    return httpOkPage(data, total, page, limit);
  },
  { querySchema: ExtendedQuerySchema }
);
```

### Route with Request Body Validation

Validate request bodies with custom Zod schemas:

```typescript
import { z } from "zod";
import { handleRoute, httpCreated, httpOk } from "@workspace/api";

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

export const POST = handleRoute(
  async ({ body }) => {
    // TypeScript knows body structure from schema
    const user = await createUser(body);
    return httpCreated(user);
  },
  { bodySchema: CreateUserSchema }
);

export const PUT = handleRoute(
  async ({ body }) => {
    const updated = await updateUser(body);
    return httpOk(updated);
  },
  { bodySchema: CreateUserSchema }
);
```

### Combining All Schemas

You can use params, query, and body validation together:

```typescript
import { z } from "zod";
import { handleRoute, IdSchema, QuerySchema, httpOk } from "@workspace/api";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export const PATCH = handleRoute(
  async ({ params, query, body }) => {
    const { id } = params;
    const { page, limit } = query;
    // body is typed from UpdateSchema
    
    // Your logic here
    return httpOk({ success: true });
  },
  {
    paramsSchema: IdSchema,
    querySchema: QuerySchema,
    bodySchema: UpdateSchema,
  }
);
```

### Authentication with Guards

Protect routes with authentication guards:

```typescript
import { handleRoute, httpOk, httpError } from "@workspace/api";
import { userGuard } from "./guards";

export const GET = handleRoute(
  async ({ authData }) => {
    if (!authData) {
      return httpError(401, "Unauthorized");
    }
    
    // authData is typed based on your guard setup
    return httpOk({ userId: authData.user.id });
  },
  {},
  userGuard // Guard ensures user is authenticated
);
```

### Resource-Based Permissions

Check permissions on specific resources:

```typescript
import { handleRoute, httpOk, IdSchema } from "@workspace/api";
import { ownerOnlyGuard } from "./guards";

export const DELETE = handleRoute(
  async ({ params, handleResourcePermission }) => {
    const { id } = params;
    
    // Fetch the resource
    const resource = await findById(id);
    if (!resource) {
      return httpError(404, "Not found");
    }
    
    // Check if user has permission for this specific resource
    handleResourcePermission(resource); // Throws Forbidden if unauthorized
    
    await deleteResource(id);
    return httpOk({ deleted: true });
  },
  { paramsSchema: IdSchema },
  ownerOnlyGuard // Guard checks resource ownership
);
```

### Setting Up Guards

Create your own guards using `initGuards`:

```typescript
import { initGuards } from "@workspace/api";

interface AuthData {
  user?: { id: string; role: string };
  isAdmin: boolean;
}

// Define your authentication function
async function auth(req: Request): Promise<AuthData> {
  // Extract auth data from request (JWT, session, API key, etc.)
  const token = req.headers.get("authorization");
  // ... validate token and return auth data
  return {
    user: { id: "123", role: "user" },
    isAdmin: false,
  };
}

// Define permission checks
const guardChecks = {
  // Basic permission (no resource needed)
  adminOnly: (auth: AuthData) => auth.isAdmin,
  loggedIn: (auth: AuthData) => !!auth.user,
  
  // Resource-based permission (requires resource parameter)
  canEdit: (auth: AuthData, resource: { ownerId: string }) => 
    auth.isAdmin || auth.user?.id === resource.ownerId,
};

// Create guards
export const { adminOnly, loggedIn, canEdit } = initGuards({
  guardChecks,
  auth,
});
```

### Response Helpers

Use built-in response helpers for common HTTP responses:

```typescript
import {
  handleRoute,
  httpOk,
  httpCreated,
  httpDeleted,
  httpError,
} from "@workspace/api";

export const GET = handleRoute(async () => {
  return httpOk({ data: "success" }); // 200 OK
});

export const POST = handleRoute(async () => {
  return httpCreated({ id: "123" }); // 201 Created
});

export const DELETE = handleRoute(async () => {
  await deleteResource();
  return httpDeleted(); // 200 OK with { deleted: true }
});

export const GET_ERROR = handleRoute(async () => {
  return httpError(404, "Not found"); // Custom status and message
});
```

### Paginated Responses

Return paginated data with metadata:

```typescript
import { handleRoute, httpOkPage, QuerySchema } from "@workspace/api";

export const GET = handleRoute(
  async ({ query }) => {
    const { page, limit } = query;
    
    const { items, total } = await fetchItems({ page, limit });
    
    return httpOkPage(items, total, page, limit);
    // Returns:
    // {
    //   data: items,
    //   page: 1,
    //   pageCount: 10,
    //   limit: 25,
    //   total: 250,
    //   hasNext: true,
    //   hasPrev: false
    // }
  },
  { querySchema: QuerySchema }
);
```

### File Downloads

Serve files with proper headers:

```typescript
import { handleRoute, httpOkDownload } from "@workspace/api";

export const GET = handleRoute(async () => {
  const fileBuffer = await readFile("report.pdf");
  
  return httpOkDownload(fileBuffer, {
    filename: "report.pdf",
    contentType: "application/pdf",
    inline: false, // Force download (true for inline display)
  });
});
```

### Error Handling

Use custom HTTP error classes:

```typescript
import { handleRoute, BadRequest, NotFound, Forbidden } from "@workspace/api";

export const GET = handleRoute(async ({ params }) => {
  const { id } = params;
  
  if (!id) {
    throw new BadRequest("ID is required");
  }
  
  const resource = await findById(id);
  if (!resource) {
    throw new NotFound("Resource not found");
  }
  
  if (!hasPermission(resource)) {
    throw new Forbidden("Access denied");
  }
  
  return httpOk(resource);
});
```

Available error classes:
- `BadRequest` (400)
- `Unauthorized` (401)
- `Forbidden` (403)
- `NotFound` (404)
- `HttpError` (custom status)

### Form Data Support

Handle multipart/form-data requests:

```typescript
import { z } from "zod";
import { handleRoute, httpCreated } from "@workspace/api";

const UploadSchema = z.object({
  file: z.instanceof(File),
  description: z.string().optional(),
});

export const POST = handleRoute(
  async ({ body }) => {
    const { file, description } = body;
    // Handle file upload
    return httpCreated({ success: true });
  },
  { bodySchema: UploadSchema }
);
```

## API Reference

### `handleRoute(fn, schemas?, guard?)`

Creates a type-safe route handler.

**Parameters:**
- `fn`: Handler function receiving `{ req, params, query, body, handleResourcePermission, authData }`
- `schemas`: Optional object with `paramsSchema`, `querySchema`, `bodySchema` (Zod schemas)
- `guard`: Optional guard for authentication/authorization

**Returns:** Route handler function compatible with Next.js App Router, Express, etc.

### Response Helpers

- `httpOk(data, init?)` - 200 OK response
- `httpCreated(data, init?)` - 201 Created response
- `httpDeleted(data?, init?)` - 200 OK with `{ deleted: true }`
- `httpError(status, message)` - Error response with status code
- `httpOkPage(data, total, page, limit, extra?, init?)` - Paginated response
- `httpOkDownload(body, init)` - File download response

### Schemas

- `IdSchema` - Validates `{ id: string }`
- `NumericalIdSchema` - Validates `{ id: number }`
- `QuerySchema` - Validates pagination query params (`page`, `limit`, `updated_after`, `updated_before`)
- `withDefaultQuerySchema(schema)` - Extends a schema with query params
- `querySchemaToRange({ page, limit })` - Converts page/limit to `{ from, to }` range

### Guards

- `initGuards(options)` - Creates guards from permission checks
  - `options.guardChecks`: Object mapping action names to permission functions
  - `options.auth`: Function to extract auth data from request

### Errors

- `HttpError` - Base error class
- `BadRequest` - 400 error
- `Unauthorized` - 401 error
- `Forbidden` - 403 error
- `NotFound` - 404 error

## TypeScript Support

This library is built with TypeScript and provides full type inference:

- Route parameters are typed based on `paramsSchema`
- Query parameters are typed based on `querySchema`
- Request body is typed based on `bodySchema`
- `authData` is typed based on your guard's auth function return type
- Response helpers maintain generic types

## Framework Compatibility

This library works with any framework that accepts standard `Request` and `Response` objects:

- ✅ Next.js App Router
- ✅ Next.js Pages Router (with adapter)
- ✅ Express.js (with adapter)
- ✅ Cloudflare Workers
- ✅ Deno Deploy
- ✅ Bun
- ✅ Any Web Standard API

## License

MIT
