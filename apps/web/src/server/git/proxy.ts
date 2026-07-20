import { gitProxyTargetFromRequest } from "./path";
import { cloudflareEnv } from "../env";

const forwardedRequestHeaders = [
  "accept",
  "authorization",
  "content-type",
  "git-protocol",
  "user-agent",
] as const;

const forwardedResponseHeaders = [
  "cache-control",
  "content-type",
  "expires",
  "pragma",
  "www-authenticate",
] as const;

const unauthorized = () =>
  new Response("Authentication required.", {
    status: 401,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "WWW-Authenticate": 'Basic realm="RFD Git"',
    },
  });

const notFound = () =>
  new Response("Git repository not found.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

const methodNotAllowed = () =>
  new Response("Method not allowed.", {
    status: 405,
    headers: { "Content-Type": "text/plain; charset=utf-8", Allow: "GET, POST" },
  });

const forbiddenPush = () =>
  new Response("Push is not available through this clone endpoint.", {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

const badGateway = () =>
  new Response("The upstream Git service could not be reached.", {
    status: 502,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

const pickHeaders = (source: Headers, names: readonly string[]) => {
  const headers = new Headers();
  for (const name of names) {
    const value = source.get(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
};

const normalizeRemoteBase = (remote: string) => remote.replace(/\/+$/, "").replace(/\.git$/i, "");

const resolveArtifactRemote = async (repoName: string): Promise<string | null> => {
  try {
    const row = await cloudflareEnv.DB.prepare(
      "SELECT artifact_remote FROM rfd_catalog WHERE artifact_repo_name = ?",
    )
      .bind(repoName)
      .first<{ artifact_remote: string }>();
    return row?.artifact_remote ?? null;
  } catch {
    return null;
  }
};

const upstreamUrlFor = (artifactRemote: string, rest: string, requestUrl: URL) => {
  const base = `${normalizeRemoteBase(artifactRemote)}.git`;
  if (rest.startsWith("/info/refs")) {
    return `${base}/info/refs${requestUrl.search}`;
  }
  return `${base}${rest}`;
};

export const proxyGitRequest = async (request: Request): Promise<Response | null> => {
  const target = gitProxyTargetFromRequest(request);
  if (target === null) return null;

  if (request.method !== "GET" && request.method !== "POST") return methodNotAllowed();

  const { rest } = target;
  if (rest.includes("git-receive-pack")) return forbiddenPush();

  const isInfoRefs = rest === "/info/refs" || rest.startsWith("/info/refs");
  const isUploadPack = rest === "/git-upload-pack";
  if (!isInfoRefs && !isUploadPack) return notFound();

  if (isInfoRefs && request.method !== "GET") return methodNotAllowed();
  if (isUploadPack && request.method !== "POST") return methodNotAllowed();

  const requestUrl = new URL(request.url);
  if (isInfoRefs) {
    const service = requestUrl.searchParams.get("service");
    if (service === "git-receive-pack") return forbiddenPush();
    if (service !== "git-upload-pack") return notFound();
  }

  if (request.headers.get("authorization") === null) return unauthorized();

  const artifactRemote = await resolveArtifactRemote(target.repoName);
  if (artifactRemote === null) return notFound();

  const headers = pickHeaders(request.headers, forwardedRequestHeaders);
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method === "POST") {
    init.body = request.body;
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrlFor(artifactRemote, rest, requestUrl), init);
  } catch {
    return badGateway();
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: pickHeaders(upstream.headers, forwardedResponseHeaders),
  });
};
