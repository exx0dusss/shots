/**
 * Limits for when an agent, not a person, picks the paths and URLs (the MCP
 * server). Files must stay under one root directory, and hosts that only ever
 * serve machine credentials are refused.
 */
import { realpath } from "node:fs/promises";
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

/** Is this URL's host link-local or a cloud metadata service? */
export function isBlockedHost(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return true;
  }
  if (METADATA_HOSTS.has(host)) return true;
  if (/^169\.254\.\d+\.\d+$/.test(host)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(host)) return true; // fe80::/10
  if (/^::ffff:(169\.254\.|a9fe:)/.test(host)) return true; // IPv4-mapped link-local
  return host === "fd00:ec2::254";
}
