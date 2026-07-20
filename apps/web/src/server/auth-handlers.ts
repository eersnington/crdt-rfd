export interface AuthHandler {
  readonly handler: (request: Request) => Response | Promise<Response>;
}

const unsupportedSessionPaths = new Set([
  "/api/auth/list-sessions",
  "/api/auth/revoke-session",
  "/api/auth/revoke-other-sessions",
]);

const handleAuthRequest = async (auth: AuthHandler, request: Request) => {
  const path = new URL(request.url).pathname;
  if (unsupportedSessionPaths.has(path)) {
    return Response.json(
      {
        code: "SESSION_MANAGEMENT_UNAVAILABLE",
        message:
          "Per-session listing and revocation are unavailable while session tokens are stored as one-way digests. Sign out this session or revoke all sessions instead.",
      },
      { status: 501 },
    );
  }
  try {
    return await auth.handler(request);
  } catch (error) {
    console.error("Unhandled authentication request failure", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown authentication failure",
      path,
    });
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
