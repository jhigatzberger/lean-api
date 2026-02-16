// BASIC

export function httpOk<T>(data: T, init?: ResponseInit) {
  return Response.json(data, { status: 200, ...init });
}

export function httpDeleted<T>(data?: T, init?: ResponseInit) {
  return Response.json(
    { deleted: true, ...(data ?? {}) },
    { status: 200, ...init }
  );
}

export function httpCreated<T>(data: T, init?: ResponseInit) {
  return Response.json(data, { status: 201, ...init });
}

export function httpError(status: number, message: string) {
  return Response.json({ error: { message } }, { status });
}

// PAGINATION

type PageInfo = {
  page: number;
  pageCount: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export function buildPageInfo(
  total: number,
  page: number,
  limit: number
): PageInfo {
  const safeLimit = Math.max(1, limit);
  const pageCount = Math.max(1, Math.ceil(total / safeLimit));
  return {
    page,
    pageCount,
    limit: safeLimit,
    total,
    hasNext: page < pageCount,
    hasPrev: page > 1,
  };
}

export function httpOkPage<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  extra?: Record<string, unknown>,
  init?: ResponseInit
) {
  const info = buildPageInfo(total, page, limit);
  const body = { data, ...info, ...(extra ?? {}) };
  return Response.json(body, { status: 200, ...init });
}

// DOWNLOAD

type DownloadInit = ResponseInit & {
  filename: string;
  contentType?: string;
  contentLength?: number | string;
  inline?: boolean;
  cacheControl?: string;
};

export function httpOkDownload(
  body: BodyInit | null,
  init: DownloadInit
): Response {
  const {
    filename,
    contentType = "application/octet-stream",
    contentLength,
    inline = false,
    cacheControl,
    ...respInit
  } = init;

  const headers = new Headers(respInit.headers ?? {});
  headers.set("Content-Type", contentType);
  if (contentLength != null)
    headers.set("Content-Length", String(contentLength));
  if (cacheControl) headers.set("Cache-Control", cacheControl);
  headers.set("Content-Disposition", buildContentDisposition(filename, inline));

  return new Response(body, { ...respInit, status: 200, headers });
}

function buildContentDisposition(filename: string, inline: boolean): string {
  const type = inline ? "inline" : "attachment";
  const fallback = filename.replace(/[/\\"]/g, "_");
  const encoded = encodeURIComponent(filename)
    .replace(/['()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/\*/g, "%2A");
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

