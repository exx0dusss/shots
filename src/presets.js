/**
 * The fixed vocabulary of the tool: social presets, canvases (backgrounds),
 * device metrics and shadow strengths. Pure data and small pure helpers, so
 * the CLI, the MCP server and the tests all read the same lists.
 */

/**
 * `aspect` is what the canvas grows to. `min` is the smallest output the
 * platform shows crisply; output is never smaller. `width` (Open Graph only)
 * is a fixed output width, because link previews expect exactly 1200×630.
 */
import { WALLPAPERS } from "./wallpapers.js";

export const PRESETS = {
  x: { aspect: [16, 9], min: [1600, 900], label: "X post, 16:9" },
  "instagram-portrait": { aspect: [4, 5], min: [1080, 1350], label: "Instagram portrait, 4:5" },
  "instagram-square": { aspect: [1, 1], min: [1080, 1080], label: "Instagram square, 1:1" },
  og: { aspect: [1200, 630], min: [1200, 630], width: 1200, label: "Open Graph, 1200×630" },
};

/** A glow from the top left: light, main and (optionally) deep shade. */
export function glow(colours) {
  const [a, b, c] = colours;
  if (!b) return a;
  return c
    ? `radial-gradient(120% 90% at 15% 0%, ${a} 0%, ${b} 48%, ${c} 100%)`
    : `radial-gradient(120% 90% at 15% 0%, ${a} 0%, ${b} 100%)`;
}

export const CANVASES = {
  accent: glow(["#ff9a63", "#ff4f00", "#c2410c"]),
  sun: glow(["#fff0a6", "#e9c60b", "#a38700"]),
  ocean: glow(["#a5e4ff", "#0ea5e9", "#075985"]),
  violet: glow(["#d6ccff", "#7c3aed", "#3b0764"]),
  mint: glow(["#c9f7e1", "#10b981", "#065f46"]),
  rose: glow(["#ffd5dc", "#f43f5e", "#881337"]),
  dark: glow(["#2a2a2a", "#0c0c0c"]),
  soft: glow(["#fff4ec", "#ffd9c2"]),
  paper: "#f4f4f5",
  ink: "#0c0c0c",
  // Telegram-style chat wallpapers, also the backgrounds of the chat frame
  ...WALLPAPERS,
  // no canvas: a transparent image, to place on a background of your own
  none: "transparent",
};

// CSS functions that fetch or reference something outside the value itself.
const LOADS = /\b(url|image|image-set|cross-fade|element|src|var|env|attr|paint)\s*\(/i;

// One CSS colour: hex, a function such as rgb()/oklch(), or a named colour.
const COLOUR = /^(#[0-9a-f]{3,8}|[a-z]+\([\d\s.,%/a-z-]+\)|[a-z]+)$/i;

/**
 * Turn `--canvas` into a CSS background. Accepts a name (built-in, or from the
 * config file's `canvases`), one colour (solid), two or three comma-separated
 * colours (a glow), or a whole CSS gradient.
 */
export function resolveCanvas(value = "accent", custom = {}) {
  // built-ins are written here; the wallpapers among them carry a data: tile
  if (custom[value] === undefined && CANVASES[value]) return CANVASES[value];
  const raw = custom[value] ?? value;
  if (Array.isArray(raw)) return glow(raw.map(colour));
  // Anything else comes from a flag, a config file or an agent. It may paint,
  // but not load: no url(), image-set() and the like, no escapes, no at-rules.
  if (typeof raw !== "string" || /[;{}<>\\@]/.test(raw) || LOADS.test(raw)) {
    throw new Error(`Canvas "${value}" is not a colour or gradient`);
  }
  if (raw === "transparent" || /gradient\(/.test(raw)) return raw;
  const parts = raw.split(/\s*,\s*(?![^(]*\))/);
  if (parts.length > 3) throw new Error(`Canvas "${value}": give one to three colours`);
  return glow(parts.map(colour));

  function colour(c) {
    if (typeof c !== "string" || !COLOUR.test(c.trim()) || LOADS.test(c)) {
      const names = [...Object.keys(custom), ...Object.keys(CANVASES)].join(", ");
      throw new Error(`Unknown canvas "${value}". Use a colour, or one of: ${names}`);
    }
    return c.trim();
  }
}

/** "16:9" → [16, 9] */
export function parseAspect(text) {
  const [w, h] = String(text).split(/[:x/]/).map(Number);
  if (!(w > 0 && h > 0)) throw new Error(`--aspect must look like 16:9, got ${text}`);
  return [w, h];
}

/** "1280x800" → { width, height } */
export function parseViewport(text) {
  const [width, height] = String(text).split(/[x×:]/).map(Number);
  if (!(width > 0 && height > 0)) throw new Error(`--viewport must look like 1440x900`);
  return { width, height };
}

// iPhone 16 screen in points; Safari's address bar sits at the bottom.
export const PHONE = { width: 393, height: 852, status: 54, bar: 96, bezel: 14 };
export const MAC = { width: 1440, height: 900, toolbar: 52 };
export const PHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

export const DEVICES = ["desktop", "phone"];

/** Shadow strength: a multiplier on the shadow's opacity. */
export const SHADOWS = { none: 0, soft: 0.55, medium: 1, strong: 1.5 };

export function resolveShadow(value = "medium") {
  const strength = SHADOWS[value] ?? Number(value);
  if (!(strength >= 0 && strength <= 2)) {
    throw new Error(`--shadow must be ${Object.keys(SHADOWS).join(", ")} or a number 0–2`);
  }
  return strength;
}
