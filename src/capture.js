/**
 * Getting the picture of a page: capture a live URL with the installed Chrome,
 * or read an image file. Both return `{ data, mime, width, height }`.
 */
import { readFile } from "node:fs/promises";

import { chromium } from "playwright-core";
import sharp from "sharp";

import { isBlockedHost } from "./guard.js";
import { PHONE_UA } from "./presets.js";

// Dev-only overlays that must never reach a presentation shot.
const DEV_OVERLAYS = [
  "#tanstack_devtools",
  '[aria-label="Open TanStack Devtools"]',
  "nextjs-portal",
  "vite-error-overlay",
  "#__next-build-watcher",
];

/** The installed Google Chrome; `SHOTS_CHROME` names another channel or a binary. */
export function launchBrowser() {
  const chrome = process.env.SHOTS_CHROME;
  if (chrome?.includes("/")) return chromium.launch({ executablePath: chrome });
  return chromium.launch({ channel: chrome || "chrome" });
}

/**
 * @param {import("playwright-core").Browser} browser
 * @param {string} url
 * @param {object} o
 * @param {{width:number,height:number}} o.view  viewport in CSS px
 * @param {boolean} o.phone
 * @param {number} o.scale  device scale factor
 * @param {string} [o.accept]  click a button with this text first (cookie banner)
 * @param {number} [o.scroll]  scroll this many px down
 * @param {number} [o.wait]    extra ms to wait before the capture
 * @param {string[]} [o.hide]  CSS selectors to hide
 * @param {"light"|"dark"} [o.scheme]  emulated prefers-color-scheme
 * @param {boolean} [o.guarded]  abort requests to link-local and metadata hosts
 */
export async function capturePage(browser, url, o) {
  const context = await browser.newContext({
    viewport: o.view,
    deviceScaleFactor: o.scale,
    isMobile: o.phone,
    hasTouch: o.phone,
    colorScheme: o.scheme,
    ...(o.phone ? { userAgent: PHONE_UA } : {}),
  });
  try {
    if (o.guarded) {
      // covers redirects and subresources, not only the address asked for
      await context.route("**/*", (route) =>
        isBlockedHost(route.request().url()) ? route.abort("blockedbyclient") : route.continue(),
      );
    }
    const page = await context.newPage();
    // one retry: a single dropped connection should not fail a whole batch
    await page
      .goto(url, { waitUntil: "load", timeout: 30_000 })
      .catch(() => page.goto(url, { waitUntil: "load", timeout: 45_000 }));
    // A page that polls or streams never goes idle; do not hang on it.
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.addStyleTag({
      content: `${[...DEV_OVERLAYS, ...(o.hide ?? [])].join(", ")} { display: none !important; }`,
    });
    if (o.accept) {
      const clicked = await page
        .getByRole("button", { name: o.accept })
        .first()
        .click({ timeout: 3000 })
        .then(() => true)
        .catch(() => false);
      if (clicked) await page.waitForTimeout(1000);
    }
    if (o.scroll) {
      await page.evaluate((y) => window.scrollTo(0, y), o.scroll);
      await page.waitForTimeout(1200);
    }
    // Park the pointer in a corner so nothing shows a hover state.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600 + (o.wait ?? 0));
    const data = await page.screenshot({ type: "png" });
    return {
      data,
      mime: "image/png",
      width: Math.round(o.view.width * o.scale),
      height: Math.round(o.view.height * o.scale),
    };
  } finally {
    await context.close();
  }
}

const MIME = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

/** Read an image file; formats Chrome may not show are converted to PNG. */
export async function readImage(file) {
  let data = await readFile(file);
  let meta = await sharp(data).metadata();
  if (!MIME[meta.format]) {
    data = await sharp(data).png().toBuffer();
    meta = { ...meta, format: "png" };
  }
  return { data, mime: MIME[meta.format], width: meta.width, height: meta.height };
}

/** Colour of the image's top-left corner, and whether it is dark. */
export async function topTint(data) {
  const { data: px } = await sharp(data)
    .extract({ left: 2, top: 2, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [r, g, b] = px;
  return { css: `rgb(${r}, ${g}, ${b})`, dark: (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55 };
}
