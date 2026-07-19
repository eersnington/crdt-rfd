const roomPath = /^\/api\/rfd\/([^/]+)\/room$/;

export const roomIdFromRequest = (request: Request): string | null => {
  const match = roomPath.exec(new URL(request.url).pathname);
  return match?.[1] === undefined ? null : decodeURIComponent(match[1]);
};
