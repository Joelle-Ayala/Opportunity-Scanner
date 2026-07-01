export function normalizeCompanyUrl(value: string): string {
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  url.hash = "";
  return url.toString();
}

export function sameOriginUrl(base: URL, href: string): string | null {
  try {
    const next = new URL(href, base);
    if (next.origin !== base.origin) {
      return null;
    }
    next.hash = "";
    return next.toString();
  } catch {
    return null;
  }
}
