export type GitProxyTarget = {
  readonly repoName: string;
  readonly rest: string;
};

const gitPath = /^\/git\/([^/]+?)(?:\.git)?(?:(\/.*)|$)/;

export const gitProxyTargetFromRequest = (request: Request): GitProxyTarget | null => {
  const { pathname } = new URL(request.url);
  const match = gitPath.exec(pathname);
  if (match?.[1] === undefined) return null;
  const repoName = decodeURIComponent(match[1]);
  if (repoName.length === 0 || repoName.includes("..")) return null;
  const rest = match[2] ?? "";
  return { repoName, rest };
};
