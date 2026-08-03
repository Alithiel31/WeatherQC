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

export class GatewayTimeoutError extends HttpClientError {
  constructor(message: string) {
    super(message, 504);
  }
}

/**
 * Le disjoncteur refuse l'appel : l'amont a échoué de façon répétée.
 *
 * **503** plutôt que 502 : rien n'a été demandé au fournisseur cette fois-ci,
 * c'est notre propre protection qui répond. Le client peut réessayer plus tard.
 */
export class ServiceIndisponibleError extends HttpClientError {
  constructor(message: string) {
    super(message, 503);
  }
}
