import "server-only";
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import { PassThrough, pipeline } from "node:stream";
import zlib from "node:zlib";
import type { LookupFunction } from "node:net";

// Fetching a page someone pasted a link to, without letting that link reach this server's own network. Only
// web addresses on the normal ports; every address a host resolves to is checked when the connection is made,
// so a redirect or a DNS answer that changes cannot point it inward. Short timeout, size cap, few redirects.

export type SafeFetchReason = "address" | "blocked" | "status" | "type" | "size" | "timeout" | "network" | "redirects";

export class SafeFetchError extends Error {
  readonly reason: SafeFetchReason;
  constructor(message: string, reason: SafeFetchReason) {
    super(message);
    this.reason = reason;
  }
}

export type SafeFetchOptions = { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; accept?: string };
export type SafeFetchResult = { url: string; status: number; contentType: string; body: string };

const PRIVATE = new net.BlockList();
for (const [address, prefix] of [
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
  ["240.0.0.0", 4],
] as const) {
  PRIVATE.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  PRIVATE.addSubnet(address, prefix, "ipv6");
}

/** An address on a private, local, shared or reserved network, including IPv4 written inside IPv6. */
export function isPrivateAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return PRIVATE.check(address, "ipv4");
  if (family !== 6) return true;
  const mapped = /^::ffff:(?:0:)?(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return PRIVATE.check(mapped[1]!, "ipv4");
  // ::ffff:7f00:1 is 127.0.0.1 too.
  const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1]!, 16);
    const lo = parseInt(hexMapped[2]!, 16);
    return PRIVATE.check(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`, "ipv4");
  }
  return PRIVATE.check(address, "ipv6");
}

/** Resolves like the system does, then refuses the connection when any answer is a private address. */
const checkedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) {
      return callback(new SafeFetchError("That address is on a private network.", "blocked"), "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
};

/** A web address we are willing to open, or a reason it is refused. */
export function checkUrl(raw: string): URL {
  if (!URL.canParse(raw)) throw new SafeFetchError("That is not a web address.", "address");
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new SafeFetchError("Only http and https links work.", "address");
  if (url.username || url.password) throw new SafeFetchError("Links with a password in them are refused.", "address");
  if (url.port && url.port !== "80" && url.port !== "443") throw new SafeFetchError("Only links on the normal web ports work.", "address");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isPrivateAddress(host)) throw new SafeFetchError("That address is on a private network.", "blocked");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new SafeFetchError("That address is on a private network.", "blocked");
  }
  return url;
}

function getOnce(url: URL, o: Required<SafeFetchOptions>, signal: AbortSignal): Promise<{ status: number; location?: string; contentType: string; body?: Buffer }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: checkedLookup,
        signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; bstocksharp-recipes/1.0; +https://bstocksharp.dev)",
          accept: o.accept,
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "en-US,en;q=0.8",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers["content-type"] ?? "");
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, location: res.headers.location, contentType });
        }
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > o.maxBytes) {
          res.destroy();
          return reject(new SafeFetchError("That page is too big to read.", "size"));
        }
        readBody(res, o.maxBytes, signal).then((body) => resolve({ status, contentType, body }), reject);
      },
    );
    req.on("error", (err) => {
      if (err instanceof SafeFetchError) return reject(err);
      if (signal.aborted) return reject(new SafeFetchError("The site took too long to answer.", "timeout"));
      reject(new SafeFetchError("The site could not be reached.", "network"));
    });
    req.end();
  });
}

/**
 * The response body, decompressed and capped at `maxBytes`. The raw response and its decompressor are one pipeline,
 * so a connection that closes early or stalls past the timeout ends in an error instead of waiting forever.
 */
export function readBody(res: http.IncomingMessage, maxBytes: number, signal: AbortSignal): Promise<Buffer> {
  const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
  const decoder = encoding === "gzip" ? zlib.createGunzip() : encoding === "br" ? zlib.createBrotliDecompress() : encoding === "deflate" ? zlib.createInflate() : new PassThrough();
  const chunks: Buffer[] = [];
  let size = 0;
  decoder.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > maxBytes) decoder.destroy(new SafeFetchError("That page is too big to read.", "size"));
    else chunks.push(chunk);
  });
  const stop = () => res.destroy();
  signal.addEventListener("abort", stop, { once: true });
  return new Promise((resolve, reject) => {
    pipeline(res, decoder, (err) => {
      signal.removeEventListener("abort", stop);
      if (!err) resolve(Buffer.concat(chunks));
      else if (err instanceof SafeFetchError) reject(err);
      else if (signal.aborted) reject(new SafeFetchError("The site took too long to answer.", "timeout"));
      else reject(new SafeFetchError("The page could not be read.", "network"));
    });
  });
}

/** The body as text in the charset the site names, or UTF-8 when it names none we know. */
function decode(body: Buffer, contentType: string): string {
  const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  try {
    return new TextDecoder(charset ?? "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

/** GETs a public web page as text, following a few redirects, each one checked again. */
export async function safeFetchText(raw: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const o: Required<SafeFetchOptions> = { timeoutMs: 8000, maxBytes: 3_000_000, maxRedirects: 4, accept: "text/html,application/xhtml+xml", ...options };
  const signal = AbortSignal.timeout(o.timeoutMs);
  let url = checkUrl(raw);
  for (let hop = 0; hop <= o.maxRedirects; hop++) {
    const res = await getOnce(url, o, signal);
    if (res.location !== undefined) {
      url = checkUrl(new URL(res.location, url).toString());
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new SafeFetchError(`The site answered ${res.status}.`, "status");
    if (!/text\/html|application\/xhtml\+xml/i.test(res.contentType)) throw new SafeFetchError("That link is not a web page.", "type");
    return { url: url.toString(), status: res.status, contentType: res.contentType, body: decode(res.body ?? Buffer.alloc(0), res.contentType) };
  }
  throw new SafeFetchError("That link redirects too many times.", "redirects");
}
