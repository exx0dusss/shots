/**
 * Limits for when an agent, not a person, picks the paths and URLs (the MCP
 * server). Files must stay under one root directory, and hosts that only ever
 * serve machine credentials are refused.
 */
import { lookup } from "node:dns/promises";
import { realpath } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";

/** Real path of `target`; for a file that does not exist yet, of its nearest existing parent. */
async function realNearest(target) {
  const rest = [];
  for (let at = path.resolve(target); ;) {
    try {
      return path.join(await realpath(at), ...rest);
    } catch (error) {
      const parent = path.dirname(at);
      if (error.code !== "ENOENT" || parent === at) throw error;
      rest.unshift(path.basename(at));
      at = parent;
    }
  }
}

/**
 * Throw unless `target` is `root` or lies under it. Symlinks are resolved on
 * both sides, so a link inside the root that points outside it does not pass.
 */
export async function assertInside(root, target, what) {
  const base = await realpath(root);
  const real = await realNearest(target);
  const relative = path.relative(base, real);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(
      `${what} is outside the allowed directory ${base}: ${target}. ` +
        "Start the server in the project, set SHOTS_ROOT, or SHOTS_ALLOW_OUTSIDE=1",
    );
  }
}

// Cloud metadata endpoints and link-local addresses: no page to screenshot
// lives there, only instance credentials.
const METADATA_HOSTS = new Set(["metadata", "metadata.google.internal", "instance-data"]);

/** Is this IP address (as text) link-local or a cloud metadata address? */
export function isBlockedAddress(address) {
  const ip = address.toLowerCase();
  if (/^169\.254\.\d+\.\d+$/.test(ip)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(ip)) return true; // fe80::/10
  if (/^::ffff:(169\.254\.|a9fe:)/.test(ip)) return true; // IPv4-mapped link-local
  return ip === "fd00:ec2::254";
}

/** The URL's host: lower case, no IPv6 brackets, no trailing dot. Null if unparsable. */
function hostOf(url) {
  try {
    return new URL(url).hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "")
      .replace(/\.+$/, "");
  } catch {
    return null;
  }
}

/** By name alone: is this URL's host link-local or a cloud metadata service? */
export function isBlockedHost(url) {
  const host = hostOf(url);
  return host === null || METADATA_HOSTS.has(host) || isBlockedAddress(host);
}

const resolved = new Map();

/**
 * `isBlockedHost`, and also true when the host name resolves to a blocked
 * address (a public name pointed at 169.254.169.254). Answers are remembered
 * per host for the life of the process.
 * @param {string} url
 * @param {(host: string, o: {all: true}) => Promise<{address: string}[]>} [resolve]
 */
export async function isBlockedUrl(url, resolve = lookup) {
  if (isBlockedHost(url)) return true;
  if (!/^(https?|wss?):/i.test(url)) return false; // data:, blob:, about:
  const host = hostOf(url);
  if (isIP(host)) return false;
  if (!resolved.has(host)) {
    resolved.set(
      host,
      resolve(host, { all: true }).then(
        (found) => found.some((entry) => isBlockedAddress(entry.address)),
        () => false, // does not resolve: the browser cannot reach it either
      ),
    );
  }
  return resolved.get(host);
}
