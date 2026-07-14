import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export const HTTP_OUTBOUND_PROTOCOLS = ["http:", "https:"] as const;
export const HTTPS_OUTBOUND_PROTOCOLS = ["https:"] as const;

const DEFAULT_MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BLOCKED_HOSTNAMES = [
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "broadcasthost",
  "metadata.google.internal",
  "metadata.google",
  "instance-data",
  "instance-data.ec2.internal",
  "metadata.aws.internal"
] as const;
const BLOCKED_IPV4_CIDRS = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4]
] as const;
const BLOCKED_IPV6_CIDRS = [
  ["2001::", 32],
  ["2001:1::", 32],
  ["2001:2::", 48],
  ["2001:10::", 28],
  ["2001:20::", 28],
  ["2001:30::", 28],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20]
] as const;

export type OutboundProtocol = (typeof HTTP_OUTBOUND_PROTOCOLS)[number];
export type OutboundDnsLookup = (
  hostname: string
) => Promise<readonly { address: string; family?: number }[]>;

export interface SafeOutboundUrlOptions {
  allowedProtocols?: readonly OutboundProtocol[];
  fetchImpl?: typeof fetch;
  lookup?: OutboundDnsLookup;
  maxRedirects?: number;
}

export class UnsafeOutboundUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeOutboundUrlError";
  }
}

const defaultLookup: OutboundDnsLookup = async (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

function ipv4ToBigInt(address: string): bigint {
  return address
    .split(".")
    .reduce((value, octet) => (value << 8n) | BigInt(Number(octet)), 0n);
}

function ipv6ToBigInt(address: string): bigint {
  if (address.includes("%")) {
    throw new UnsafeOutboundUrlError("Scoped IPv6 addresses are not allowed.");
  }

  let normalized = address.toLowerCase();
  const ipv4Tail = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (ipv4Tail) {
    const ipv4 = ipv4ToBigInt(ipv4Tail);
    normalized = `${normalized.slice(0, -ipv4Tail.length)}${(ipv4 >> 16n).toString(16)}:${(
      ipv4 & 0xffffn
    ).toString(16)}`;
  }

  const halves = normalized.split("::");
  if (halves.length > 2) {
    throw new UnsafeOutboundUrlError("Invalid IPv6 address.");
  }

  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const zeroCount = 8 - left.length - right.length;
  if ((halves.length === 1 && zeroCount !== 0) || zeroCount < 0) {
    throw new UnsafeOutboundUrlError("Invalid IPv6 address.");
  }

  const groups = halves.length === 2 ? [...left, ...Array(zeroCount).fill("0"), ...right] : left;
  if (groups.length !== 8) {
    throw new UnsafeOutboundUrlError("Invalid IPv6 address.");
  }

  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group || "0"}`), 0n);
}

function isInCidr(value: bigint, network: bigint, prefix: number, width: number): boolean {
  const shift = BigInt(width - prefix);
  return value >> shift === network >> shift;
}

function isBlockedIpv4(address: string): boolean {
  const value = ipv4ToBigInt(address);
  return BLOCKED_IPV4_CIDRS.some(([network, prefix]) =>
    isInCidr(value, ipv4ToBigInt(network), prefix, 32)
  );
}

function isBlockedIpv6(address: string): boolean {
  const value = ipv6ToBigInt(address);
  const mappedIpv4Network = ipv6ToBigInt("::ffff:0:0");
  if (isInCidr(value, mappedIpv4Network, 96, 128)) {
    const mappedIpv4 = [24n, 16n, 8n, 0n]
      .map((shift) => Number((value >> shift) & 0xffn))
      .join(".");
    return isBlockedIpv4(mappedIpv4);
  }

  const globallyRoutableNetwork = ipv6ToBigInt("2000::");
  if (!isInCidr(value, globallyRoutableNetwork, 3, 128)) {
    return true;
  }

  return BLOCKED_IPV6_CIDRS.some(([network, prefix]) =>
    isInCidr(value, ipv6ToBigInt(network), prefix, 128)
  );
}

function normalizedHostname(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
}

function isBlockedHostname(hostname: string): boolean {
  return BLOCKED_HOSTNAMES.some(
    (blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`)
  );
}

function assertPublicIpAddress(address: string): void {
  const family = isIP(address);
  if (!family) {
    throw new UnsafeOutboundUrlError("DNS returned an invalid IP address.");
  }
  if ((family === 4 && isBlockedIpv4(address)) || (family === 6 && isBlockedIpv6(address))) {
    throw new UnsafeOutboundUrlError("Outbound requests to this IP address are not allowed.");
  }
}

export function parseOutboundUrl(
  value: string | URL,
  allowedProtocols: readonly OutboundProtocol[] = HTTP_OUTBOUND_PROTOCOLS
): URL {
  let url: URL;
  try {
    url = new URL(value.toString());
  } catch {
    throw new UnsafeOutboundUrlError("Outbound URL is malformed.");
  }

  if (!allowedProtocols.includes(url.protocol as OutboundProtocol)) {
    throw new UnsafeOutboundUrlError("Outbound URL protocol is not allowed.");
  }
  if (url.username || url.password) {
    throw new UnsafeOutboundUrlError("Outbound URLs cannot include credentials.");
  }

  const hostname = normalizedHostname(url);
  if (!hostname || isBlockedHostname(hostname)) {
    throw new UnsafeOutboundUrlError("Outbound requests to this hostname are not allowed.");
  }

  const family = isIP(hostname);
  if (family) {
    assertPublicIpAddress(hostname);
  }

  url.hash = "";
  return url;
}

export async function assertSafeOutboundUrl(
  value: string | URL,
  options: SafeOutboundUrlOptions = {}
): Promise<URL> {
  const url = parseOutboundUrl(value, options.allowedProtocols);
  const hostname = normalizedHostname(url);
  if (isIP(hostname)) {
    return url;
  }

  let addresses: readonly { address: string; family?: number }[];
  try {
    addresses = await (options.lookup ?? defaultLookup)(hostname);
  } catch {
    throw new UnsafeOutboundUrlError("Outbound destination DNS lookup failed.");
  }
  if (addresses.length === 0) {
    throw new UnsafeOutboundUrlError("Outbound destination did not resolve to an IP address.");
  }
  for (const { address } of addresses) {
    assertPublicIpAddress(address);
  }
  return url;
}

function redirectedRequestInit(init: RequestInit, status: number): RequestInit {
  const method = (init.method ?? "GET").toUpperCase();
  const switchToGet = (status === 303 && method !== "HEAD") ||
    ((status === 301 || status === 302) && method === "POST");
  if (!switchToGet) {
    return init;
  }

  const headers = new Headers(init.headers);
  headers.delete("content-length");
  headers.delete("content-type");
  return { ...init, method: "GET", body: undefined, headers };
}

export async function fetchSafeOutboundUrl(
  value: string | URL,
  init: RequestInit = {},
  options: SafeOutboundUrlOptions = {}
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let currentUrl: string | URL = value;
  let currentInit = { ...init };

  for (let redirectCount = 0; ; redirectCount += 1) {
    const url = await assertSafeOutboundUrl(currentUrl, options);
    const response = await fetchImpl(url.toString(), { ...currentInit, redirect: "manual" });
    const location = response.headers.get("location");
    if (!REDIRECT_STATUSES.has(response.status) || !location) {
      return response;
    }
    if (redirectCount >= maxRedirects) {
      throw new UnsafeOutboundUrlError("Outbound request exceeded the redirect limit.");
    }

    await response.body?.cancel().catch(() => undefined);
    currentUrl = new URL(location, url);
    currentInit = redirectedRequestInit(currentInit, response.status);
  }
}

export function normalizeCompanyUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new UnsafeOutboundUrlError("Company URL is required.");
  }

  const explicitScheme = trimmed.match(/^([a-z][a-z\d+.-]*):/i)?.[1];
  if (explicitScheme && !/^https?$/i.test(explicitScheme)) {
    throw new UnsafeOutboundUrlError("Company URL protocol is not allowed.");
  }
  if (explicitScheme && !/^https?:\/\//i.test(trimmed)) {
    throw new UnsafeOutboundUrlError("Company URL is malformed.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return parseOutboundUrl(withProtocol).toString();
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
