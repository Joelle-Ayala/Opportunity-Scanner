export function safeSameOriginRedirect(
  candidate: string | null | undefined,
  appOrigin: string,
  fallback = "/"
): string {
  if (!candidate || candidate.includes("\\")) return fallback;

  try {
    const base = new URL(appOrigin);
    const resolved = new URL(candidate, base);
    if (resolved.origin !== base.origin || resolved.username || resolved.password) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export function isSameOriginRequest(request: Request, appOrigin: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(appOrigin).origin;
  } catch {
    return false;
  }
}
