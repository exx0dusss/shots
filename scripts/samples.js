#!/usr/bin/env node
/**
 * Regenerate the README's sample images: every preset on both devices, then
 * the compositions and looks. `pnpm samples [url]`.
 *
 * The site is captured once per device (bare, `frame: "none"`) and those
 * images are framed many times, so all the samples cost four page loads.
 * The Telegram samples shoot the demo Mini App and conversation in
 * `samples/demo`, served from this script.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";

import { PRESETS, frameShot, launchBrowser } from "../src/index.js";

const url = (process.argv[2] ?? "https://tymurmustafaiev.com").replace(/\/$/, "");
const dir = path.join(import.meta.dirname, "..", "samples");
// README images: lighter than native, still sharp on a retina screen
const light = { width: 1800, quality: 86 };

const tmp = await mkdtemp(path.join(os.tmpdir(), "shots-samples-"));
const raw = {
  desktop: path.join(tmp, "desktop.png"),
  phone: path.join(tmp, "phone.png"),
  about: path.join(tmp, "about.png"),
  dark: path.join(tmp, "dark.png"),
};
const bar = new URL(url).host;

const canvases = {
  x: "accent",
  "instagram-portrait": "ocean",
  "instagram-square": "sun",
  og: "dark",
};
const presets = Object.keys(PRESETS).flatMap((preset) =>
  ["desktop", "phone"].map((device) => ({
    name: `${device}-${preset}`,
    sources: [raw[device]],
    device,
    preset,
    canvas: canvases[preset],
  })),
);
const looks = [
  {
    name: "two-phones",
    sources: [raw.phone, raw.about],
    device: "phone",
    preset: "x",
    canvas: "violet",
    tilt: 5,
  },
  {
    name: "desktop-phone",
    sources: [raw.desktop, raw.phone],
    device: "desktop,phone",
    preset: "x",
    canvas: "mint",
  },
  {
    name: "tilt",
    sources: [raw.phone],
    device: "phone",
    preset: "instagram-square",
    canvas: "rose",
    tilt: -8,
    shadow: "strong",
  },
  { name: "dark", sources: [raw.dark], preset: "x", canvas: "ocean", shadow: "strong" },
  {
    name: "custom-colours",
    sources: [raw.desktop],
    preset: "x",
    canvas: "#fde68a,#f59e0b,#7c2d12",
    bar: "none",
  },
  { name: "transparent", sources: [raw.phone], device: "phone", canvas: "none" },
];

// the demo Mini App, on a local port
const demo = path.join(dir, "demo");
const server = createServer(async (request, response) => {
  try {
    const name = path.basename(new URL(request.url, "http://localhost").pathname);
    response.setHeader("content-type", name.endsWith(".html") ? "text/html" : "image/png");
    response.end(await readFile(path.join(demo, name)));
  } catch {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const app = `http://127.0.0.1:${server.address().port}/miniapp.html`;
const chat = path.join(demo, "chat.json");
const telegram = [
  {
    name: "telegram-app-phone",
    sources: [app],
    device: "phone",
    frame: "telegram-app",
    button: "Play all",
    preset: "instagram-portrait",
    canvas: "telegram-blue",
  },
  {
    name: "telegram-app-desktop",
    sources: [app],
    frame: "telegram-app",
    scheme: "dark",
    preset: "instagram-square",
    canvas: "violet",
  },
  {
    name: "telegram-chat-phone",
    sources: [chat],
    device: "phone",
    preset: "instagram-portrait",
    canvas: "telegram-rose",
  },
  { name: "telegram-chat-desktop", sources: [chat], theme: "dark", preset: "x", canvas: "ocean" },
  {
    name: "telegram-chat-app",
    sources: [chat, app],
    frame: "telegram-chat,telegram-app",
    preset: "x",
    canvas: "telegram-violet",
  },
  {
    name: "telegram-pair",
    sources: [chat, app],
    device: "phone",
    frame: "telegram-chat,telegram-app",
    tilt: 5,
    preset: "x",
    canvas: "telegram-amber",
  },
  {
    name: "telegram-wallpaper-dark",
    sources: [chat],
    device: "phone",
    theme: "dark",
    preset: "instagram-square",
    canvas: "telegram-dark",
  },
];

const browser = await launchBrowser();
try {
  const bare = { frame: "none" };
  await frameShot({ ...bare, sources: [url], out: raw.desktop }, { browser });
  await frameShot({ ...bare, sources: [url], device: "phone", out: raw.phone }, { browser });
  await frameShot(
    { ...bare, sources: [`${url}/en/about`], device: "phone", out: raw.about },
    { browser },
  );
  await frameShot({ ...bare, sources: [url], scheme: "dark", out: raw.dark }, { browser });

  for (const { name, ...options } of [...presets, ...looks, ...telegram]) {
    const ext = name === "transparent" ? "png" : "webp";
    const done = await frameShot(
      { ...light, bar, ...options, out: path.join(dir, `${name}.${ext}`) },
      { browser },
    );
    console.log(`${name}  ${done.width}×${done.height}`);
  }
} finally {
  await browser.close();
  server.close();
  await rm(tmp, { recursive: true, force: true });
}
