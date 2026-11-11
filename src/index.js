/**
 * `frameShot(options)`: capture or read one or two sources, draw each in its
 * device, lay them out on a canvas and write the image. The CLI and the MCP
 * server are both thin wrappers over this function.
 *
 * Everything is laid out on ONE page and screenshotted once. A frame is never
 * rendered on its own and trimmed, so its shadow can only end at the canvas
 * edge and always fades out softly.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { capturePage, launchBrowser, readImage, topTint } from "./capture.js";
import { loadConfig } from "./config.js";
import { assertInside, isBlockedUrl } from "./guard.js";
import { iPhone, macWindow, viewOf } from "./frames.js";
import { arrange, canvasSize } from "./layout.js";
import {
  DEVICES,
  MAC,
  PRESETS,
  parseAspect,
  parseViewport,
  resolveCanvas,
  resolveShadow,
} from "./presets.js";

export { loadConfig } from "./config.js";
export { launchBrowser } from "./capture.js";
export { CANVASES, DEVICES, PRESETS, SHADOWS } from "./presets.js";

// Room a transparent image keeps around the frame so the shadow is not cut.
const TRANSPARENT_PAD = 200;
const FORMATS = { ".png": "png", ".webp": "webp", ".jpg": "jpeg", ".jpeg": "jpeg" };

/** A URL, or a path to an image. `localhost:3000` and `example.com` count as URLs. */
export function classifySource(source, cwd) {
  if (/^https?:\/\//i.test(source)) return { kind: "url", url: source };
  const file = path.resolve(cwd, source);
  if (existsSync(file)) return { kind: "image", file };
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/.test(source)) {
    return { kind: "url", url: `http://${source}` };
  }
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/|$)/.test(source) && !FORMATS[path.extname(source)]) {
    return { kind: "url", url: `https://${source}` };
  }
  throw new Error(`Not a URL and no such image: ${source}`);
}

/** Options with the config's defaults applied, validated and typed. */
export async function resolveOptions(input, root = null) {
  const cwd = path.resolve(input.cwd ?? process.cwd());
  if (root) await assertInside(root, cwd, "cwd");
  const config = await loadConfig(cwd, input.config);
  const given = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  const o = { ...config.defaults, ...given };

  const sources = [o.sources ?? o.source].flat().filter(Boolean);
  if (sources.length < 1 || sources.length > 2) throw new Error("Give one or two sources");
  let devices = [o.devices ?? o.device ?? "desktop"].flat().flatMap((d) => String(d).split(/[,+]/));
  if (devices.length === 1 && sources.length === 2) devices = [devices[0], devices[0]];
  if (devices.length !== sources.length) {
    throw new Error(`${sources.length} source(s) but ${devices.length} device(s)`);
  }
  for (const d of devices) {
    if (!DEVICES.includes(d)) throw new Error(`--device must be desktop or phone, got ${d}`);
  }

  if (o.preset && !PRESETS[o.preset]) {
    throw new Error(`--preset must be one of ${Object.keys(PRESETS).join(", ")}`);
  }
  const preset = o.preset ? PRESETS[o.preset] : null;
  if (o.frame !== undefined && o.frame !== "none") {
    throw new Error(`--frame only accepts "none", got ${o.frame}`);
  }
  if (!o.out) throw new Error("--out is required");
  const out = path.resolve(cwd, o.out);
  const classified = sources.map((s) => classifySource(s, cwd));
  // with a root (the MCP server) nothing is read or written outside it
  if (root) {
    await assertInside(root, out, "out");
    for (const source of classified) {
      if (source.kind === "image") await assertInside(root, source.file, "source");
      else if (await isBlockedUrl(source.url)) throw new Error(`Refusing to open ${source.url}`);
    }
  }
  const format = FORMATS[path.extname(out).toLowerCase()];
  if (!format) throw new Error("--out must end in .png, .webp or .jpg");

  const number = (name, fallback, min, max) => {
    const n = o[name] === undefined ? fallback : Number(o[name]);
    if (!(n >= min && n <= max)) throw new Error(`--${name} must be ${min}–${max}, got ${o[name]}`);
    return n;
  };
  const canvas = resolveCanvas(o.canvas, config.canvases);
  const shadow = resolveShadow(o.shadow);
  const theme = o.theme ?? "auto";
  if (!["auto", "light", "dark"].includes(theme)) throw new Error("--theme: auto, light or dark");
  if (o.scheme && !["light", "dark"].includes(o.scheme)) throw new Error("--scheme: light or dark");

  let pad = number("pad", 120, 0, 2000);
  // a transparent image needs room for the shadow to fade out in
  if (canvas === "transparent" && shadow > 0) pad = Math.max(pad, TRANSPARENT_PAD);

  return {
    cwd,
    sources: classified,
    guarded: Boolean(root),
    devices,
    out,
    format,
    bare: o.frame === "none",
    preset,
    presetName: o.preset ?? null,
    aspect: o.aspect ? parseAspect(o.aspect) : (preset?.aspect ?? null),
    canvas,
    canvasName: o.canvas ?? "accent",
    pad,
    shadow,
    theme,
    scheme: o.scheme,
    tilt: number("tilt", 0, -45, 45),
    scale: number("scale", 2, 1, 3),
    // output width in px; "native" keeps every captured pixel
    width: o.width === undefined || o.width === "native" ? null : number("width", 0, 200, 12000),
    native: o.width === "native",
    quality: number("quality", 90, 1, 100),
    viewport: o.viewport ? parseViewport(o.viewport) : null,
    bar: o.bar,
    accept: o.accept,
    scroll: o.scroll === undefined ? 0 : number("scroll", 0, 0, 1e6),
    wait: o.wait === undefined ? 0 : number("wait", 0, 0, 60000),
    hide: [o.hide ?? []].flat().flatMap((h) => String(h).split(",")),
  };
}

/** The address text for a source; null draws the device with no Safari chrome. */
function addressFor(bar, source) {
  if (bar === "none") return null;
  if (bar !== undefined) return bar;
  return source.kind === "url" ? new URL(source.url).host.replace(/^www\./, "") : "";
}

async function encode(png, o, size) {
  let image = sharp(png);
  if (size) image = image.resize({ ...size, fit: "fill" });
  if (o.format === "webp") return image.webp({ quality: o.quality, effort: 5 }).toBuffer();
  if (o.format === "jpeg") {
    return image
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: o.quality, mozjpeg: true })
      .toBuffer();
  }
  return image.png().toBuffer();
}

/**
 * @param {object} input  see README, "Options". `sources` (or `source`) and `out` are required.
 * @param {{browser?: import("playwright-core").Browser, root?: string}} [shared]
 *   `browser`: reuse one across calls (batch); otherwise one is launched and
 *   closed here. `root`: refuse to read or write files outside this directory
 *   and to open link-local hosts (set by the MCP server).
 * @returns {Promise<{out:string,width:number,height:number,preset:string|null,canvas:string}>}
 */
export async function frameShot(input, shared = {}) {
  const o = await resolveOptions(input, shared.root);
  const browser = shared.browser ?? (await launchBrowser());
  try {
    if (o.bare && o.sources.length > 1) throw new Error("--frame none takes one source");

    // 1. a picture of each source, at the size its device shows it
    const shots = [];
    for (const [i, source] of o.sources.entries()) {
      const device = o.devices[i];
      const address = o.bare ? null : addressFor(o.bar, source);
      const chrome = address !== null;
      let view = o.bare
        ? device === "phone"
          ? { width: 393, height: 852 }
          : (o.viewport ?? { width: MAC.width, height: MAC.height })
        : viewOf(device, { chrome, viewport: o.viewport });
      let picture;
      if (source.kind === "url") {
        picture = await capturePage(browser, source.url, {
          view,
          phone: device === "phone",
          scale: o.scale,
          accept: o.accept,
          scroll: o.scroll,
          wait: o.wait,
          hide: o.hide,
          scheme: o.scheme,
          guarded: o.guarded,
        });
      } else {
        picture = await readImage(source.file);
        // a desktop window takes the image's own shape, at the usual width
        if (device === "desktop" && !o.viewport) {
          view = {
            width: MAC.width,
            height: Math.round((MAC.width * picture.height) / picture.width),
          };
        }
      }
      shots.push({ device, address, view, picture });
    }

    await mkdir(path.dirname(o.out), { recursive: true });
    if (o.bare) {
      const { picture } = shots[0];
      await writeFile(o.out, await encode(picture.data, o));
      return result(o, picture.width, picture.height);
    }

    // 2. draw the devices
    const frames = [];
    for (const shot of shots) {
      const tint = await topTint(shot.picture.data);
      const dark = o.theme === "auto" ? tint.dark : o.theme === "dark";
      const src = `data:${shot.picture.mime};base64,${shot.picture.data.toString("base64")}`;
      const frame =
        shot.device === "phone"
          ? iPhone({ src, tint, address: shot.address, dark, shadow: o.shadow })
          : macWindow({ src, view: shot.view, address: shot.address, dark, shadow: o.shadow });
      frames.push({ ...frame, device: shot.device });
    }

    // 3. lay them out and size the canvas
    const stage = arrange(frames, o.tilt);
    const canvas = canvasSize(stage.box, o.pad, o.aspect);
    // never below what the preset needs, even for a small layout
    const minWidth = o.preset?.min[0] ?? 0;
    const renderScale = Math.min(4, Math.max(o.scale, minWidth / canvas.width));
    const html = pageHtml(frames, stage, canvas, o.canvas);

    // 4. one screenshot of the whole canvas
    const page = await browser.newPage({ viewport: canvas, deviceScaleFactor: renderScale });
    let png;
    try {
      await page.setContent(html);
      await page.waitForFunction(() =>
        [...document.images].every((img) => img.complete && img.naturalWidth > 0),
      );
      png = await page.screenshot({ type: "png", omitBackground: o.canvas === "transparent" });
    } finally {
      await page.close();
    }

    // 5. size and encode. Native by default; a preset with a fixed width
    // (Open Graph) or --width scales down, never up.
    const native = await sharp(png).metadata();
    const target = o.native ? null : (o.width ?? o.preset?.width ?? null);
    let size = null;
    if (target && target < native.width) {
      const ratio = o.aspect ? o.aspect[1] / o.aspect[0] : native.height / native.width;
      size = { width: target, height: Math.round(target * ratio) };
    }
    await writeFile(o.out, await encode(png, o, size));
    return result(o, size?.width ?? native.width, size?.height ?? native.height);
  } finally {
    if (!shared.browser) await browser.close();
  }
}

function result(o, width, height) {
  return { out: o.out, width, height, preset: o.presetName, canvas: o.canvasName };
}

function pageHtml(frames, stage, canvas, background) {
  const css = frames.map((frame, i) => `.f${i} { ${frame.css} }`).join("\n");
  const items = frames
    .map((frame, i) => {
      const item = stage.items[i];
      const style = [
        `left:${item.cx - frame.width / 2}px`,
        `top:${item.cy - frame.height / 2}px`,
        `width:${frame.width}px`,
        `height:${frame.height}px`,
        `z-index:${item.z}`,
        `transform:rotate(${item.rotate}deg) scale(${item.scale})`,
      ].join(";");
      return `<div class="item f${i}" style="${style}">${frame.html}</div>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; }
    html { background: transparent; }
    body { width: ${canvas.width}px; height: ${canvas.height}px; overflow: hidden; background: ${background};
      display: grid; place-items: center; font-family: -apple-system, "SF Pro Text", system-ui, sans-serif; }
    .stage { position: relative; width: ${stage.width}px; height: ${stage.height}px; transform: rotate(${stage.rotate}deg); }
    .item { position: absolute; }
    ${css}
  </style></head><body><div class="stage">${items}</div></body></html>`;
}
