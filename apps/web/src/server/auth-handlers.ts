export interface AuthHandler {
  readonly handler: (request: Request) => Response | Promise<Response>;
}

export const authHandlers = (auth: AuthHandler) => ({
  GET: ({ request }: { request: Request }) => auth.handler(request),
  POST: ({ request }: { request: Request }) => auth.handler(request),
});
