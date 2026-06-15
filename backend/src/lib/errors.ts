export class HttpClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

export class BadRequestError extends HttpClientError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends HttpClientError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class BadGatewayError extends HttpClientError {
  constructor(message: string) {
    super(message, 502);
  }
}
