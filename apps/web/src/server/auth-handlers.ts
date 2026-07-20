export interface AuthHandler {
  readonly handler: (request: Request) => Response | Promise<Response>;
}

const handleAuthRequest = async (auth: AuthHandler, request: Request) => {
  try {
    return await auth.handler(request);
  } catch (error) {
    console.error("Unhandled authentication request failure", error);
    return Response.json(
      {
        code: "AUTH_REQUEST_FAILED",
        message:
          "Authentication could not be started. Check the server logs for the underlying error.",
      },
      { status: 500 },
    );
  }
};

export const authHandlers = (auth: AuthHandler) => ({
  GET: ({ request }: { request: Request }) => handleAuthRequest(auth, request),
  POST: ({ request }: { request: Request }) => handleAuthRequest(auth, request),
});
