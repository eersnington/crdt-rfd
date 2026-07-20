const isLoopbackHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

export const publicCloneRemote = (input: {
  readonly appOrigin: string;
  readonly artifactRepoName: string;
  readonly artifactRemote: string;
}): string => {
  try {
    const origin = new URL(input.appOrigin);
    if (isLoopbackHost(origin.hostname)) return input.artifactRemote;
    return `${origin.origin}/git/${input.artifactRepoName}.git`;
  } catch {
    return input.artifactRemote;
  }
};
