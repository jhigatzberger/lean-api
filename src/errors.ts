export class HttpError extends Error {
  constructor(
    public status: number,
    msg: string
  ) {
    super(msg);
  }
}
export class BadRequest extends HttpError {
  constructor(msg = "Bad request") {
    super(400, msg);
  }
}
export class Unauthorized extends HttpError {
  constructor(msg = "Unauthorized") {
    super(401, msg);
  }
}
export class Forbidden extends HttpError {
  constructor(msg = "Forbidden") {
    super(403, msg);
  }
}
export class NotFound extends HttpError {
  constructor(msg = "Not found") {
    super(404, msg);
  }
}