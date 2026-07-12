export interface CookieOptions {
  readonly maxAge?: number;
  readonly path?: string;
  readonly sameSite?: "Lax" | "Strict";
}

export const secureCookie = (name: string, value: string, options: CookieOptions = {}): string => {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? "/"}`,
    "HttpOnly",
    "Secure",
    `SameSite=${options.sameSite ?? "Lax"}`,
  ];
  if (options.maxAge !== undefined)
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  return parts.join("; ");
};

export const expireCookie = (name: string, path = "/"): string =>
  secureCookie(name, "", { maxAge: 0, path });

export const readCookie = (header: string | null, name: string): string | undefined => {
  if (header === null) return undefined;
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    try {
      if (decodeURIComponent(pair.slice(0, separator).trim()) === name)
        return decodeURIComponent(pair.slice(separator + 1).trim());
    } catch {
      // Malformed cookie pairs are untrusted input and can be ignored safely.
    }
  }
  return undefined;
};
