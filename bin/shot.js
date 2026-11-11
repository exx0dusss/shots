#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { CANVASES, PRESETS, SHADOWS, frameShot, launchBrowser, loadConfig } from "../src/index.js";

const HELP = `shot: frame a web page or an image in a Safari window or an iPhone.

  shot <url|image> [<url|image>] --out <file> [options]
  shot --batch <dir> --out <dir> [options]
  shot list                       presets and canvases, including your config's

Sources
  One or two. A URL is captured with the installed Chrome; an image file is
  framed as it is. Two sources make a composition: two phones, or
  --device desktop,phone for a window with a phone in front.

Options
  --out <file>         output image: .png, .webp or .jpg (required)
  --device <kind>      desktop (default) or phone; two sources: desktop,phone
  --preset <name>      ${Object.keys(PRESETS).join(", ")}
  --aspect <w:h>       free canvas ratio instead of a preset, e.g. 3:2
  --canvas <name>      ${Object.keys(CANVASES).join(", ")};
                       or a colour ("#0ea5e9"), two or three colours for a glow
                       ("#a5e4ff,#0ea5e9,#075985"), a CSS gradient, or a name
                       from shots.config.json (default accent)
  --pad <px>           canvas padding around the frame, CSS px (default 120)
  --shadow <strength>  ${Object.keys(SHADOWS).join(", ")}, or a number 0–2 (default medium)
  --tilt <deg>         turn the frame; two phones fan apart (default 0)
  --bar <text>         address shown in Safari (default: the URL's host);
                       "none" draws the window or phone with no Safari chrome
  --theme <t>          Safari chrome: auto (follows the page), light or dark
  --frame <kind>       what is drawn in the device: safari (default),
                       telegram-app (Mini App), telegram-chat, or none to
                       write the bare capture and stop. Two sources: a,b
  --width <px>         output width; default native (og: 1200). "native" forces it
  --scale <n>          device pixel ratio, 1–3 (default 2)
  --quality <n>        WebP and JPEG quality (default 90)

Telegram frames
  --title <text>       Mini App title or chat name (default: the page's title)
  --subtitle <text>    under the title: "mini app", "bot", "online", …
  --button <text>      telegram-app: main button under the page
  --wallpaper <name>   telegram-chat background: telegram (default, follows
                       the theme), telegram-light, telegram-dark, telegram-blue,
                       telegram-rose, telegram-violet, telegram-amber, or
                       anything --canvas accepts
  --avatar <image>     telegram-chat: avatar picture (default: initials)
  --menu <text>        telegram-chat: the bot's menu button in the composer
  A .json source is a conversation rendered as chat bubbles; see the README.

Capturing a URL
  --viewport <WxH>     desktop page size in CSS px (default 1440x900)
  --scheme <s>         emulate prefers-color-scheme: light or dark
  --accept <text>      click a button with this text first (cookie banner)
  --scroll <px>        scroll down before capturing
  --wait <ms>          wait longer before capturing
  --hide <selectors>   CSS selectors to hide, comma separated

Other
  --batch <dir>        frame every image under <dir> with the same options,
                       writing the same tree under --out (a directory)
  --config <file>      config file (default: shots.config.json, found upwards)
  -h, --help
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", short: "o" },
    device: { type: "string", short: "d" },
    preset: { type: "string", short: "p" },
    aspect: { type: "string" },
    canvas: { type: "string", short: "c" },
    pad: { type: "string" },
    shadow: { type: "string" },
    tilt: { type: "string" },
    bar: { type: "string" },
    theme: { type: "string" },
    frame: { type: "string" },
    title: { type: "string" },
    subtitle: { type: "string" },
    button: { type: "string" },
    wallpaper: { type: "string" },
    avatar: { type: "string" },
    menu: { type: "string" },
    width: { type: "string" },
    scale: { type: "string" },
    quality: { type: "string" },
    viewport: { type: "string" },
    scheme: { type: "string" },
    accept: { type: "string" },
    scroll: { type: "string" },
    wait: { type: "string" },
    hide: { type: "string" },
    batch: { type: "string" },
    config: { type: "string" },
    // the names the original script used
    url: { type: "string" },
    image: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});

/** Every image under `dir`, as paths relative to it. */
async function listImages(dir, rel = "") {
  const found = [];
  for (const entry of await readdir(path.join(dir, rel), { withFileTypes: true })) {
    const next = path.join(rel, entry.name);
    if (entry.isDirectory()) found.push(...(await listImages(dir, next)));
    else if (/\.(png|jpe?g|webp)$/i.test(entry.name)) found.push(next);
  }
  return found.sort();
}

async function list() {
  const config = await loadConfig(process.cwd(), values.config);
  console.log("Presets");
  for (const [name, p] of Object.entries(PRESETS)) console.log(`  ${name.padEnd(20)} ${p.label}`);
  console.log("\nCanvases");
  console.log(`  ${Object.keys(CANVASES).join(", ")}`);
  const own = Object.keys(config.canvases);
  if (own.length) console.log(`  from ${config.files.join(", ")}: ${own.join(", ")}`);
  console.log("\nFrames\n  safari, telegram-app, telegram-chat, none");
  console.log(`\nShadows\n  ${Object.keys(SHADOWS).join(", ")}`);
}

async function main() {
  if (values.help || (!positionals.length && !values.batch && !values.url && !values.image)) {
    console.log(HELP);
    return;
  }
  if (positionals[0] === "list") return list();

  const { batch, url, image, help: _help, ...options } = values;
  const sources = [url, image, ...positionals].filter(Boolean);

  if (batch) {
    if (!options.out) throw new Error("--batch needs --out <dir>");
    const files = await listImages(batch);
    const browser = await launchBrowser();
    try {
      for (const file of files) {
        await frameShot(
          { ...options, sources: [path.join(batch, file)], out: path.join(options.out, file) },
          { browser },
        );
      }
    } finally {
      await browser.close();
    }
    console.log(`framed ${files.length} images into ${options.out}`);
    return;
  }

  const done = await frameShot({ ...options, sources });
  const relative = path.relative(process.cwd(), done.out);
  const shown = relative.startsWith("..") ? done.out : relative;
  console.log(`${shown}  (${done.width}×${done.height})`);
}

main().catch((error) => {
  console.error(`shot: ${error.message}`);
  process.exitCode = 1;
});
