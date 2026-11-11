#!/usr/bin/env node
/**
 * MCP server (stdio): the same `frameShot` the CLI calls, as two tools.
 * stdout carries the protocol, so nothing here may print to it.
 */
import path from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import sharp from "sharp";
import { z } from "zod";

import { assertInside } from "../src/guard.js";
import { CANVASES, PRESETS, SHADOWS, frameShot, loadConfig } from "../src/index.js";
import { WALLPAPERS } from "../src/wallpapers.js";

const server = new McpServer({ name: "shots", version: "0.1.0" });

// An agent chooses the paths here, so files are confined to one directory:
// where the server was started (the project), or SHOTS_ROOT.
// SHOTS_ALLOW_OUTSIDE=1 lifts the limit.
const root =
  process.env.SHOTS_ALLOW_OUTSIDE === "1"
    ? null
    : path.resolve(process.env.SHOTS_ROOT ?? process.cwd());

const presetNames = Object.keys(PRESETS);

// A Telegram conversation, rendered as chat bubbles by the telegram-chat frame.
const conversation = z
  .object({
    title: z.string().optional().describe("Chat name"),
    subtitle: z.string().optional().describe("Status under the name, e.g. bot, online"),
    avatar: z.string().optional().describe("Path to an avatar image"),
    menu: z.string().optional().describe("Text of the bot's menu button"),
    theme: z.enum(["light", "dark"]).optional(),
    wallpaper: z.string().optional(),
    messages: z
      .array(
        z.object({
          from: z.enum(["me", "them"]).optional().describe("me = right, green; them = left"),
          text: z
            .string()
            .optional()
            .describe(
              "Supports **bold**, `code` and line breaks; links, @names and /commands are coloured",
            ),
          image: z.string().optional().describe("Path to a picture shown in the bubble"),
          time: z.string().optional().describe("Shown in the bubble (default 9:41)"),
          buttons: z
            .array(z.array(z.string()))
            .optional()
            .describe("Inline keyboard under the message: rows of button texts"),
          date: z
            .string()
            .optional()
            .describe("Instead of a message: a day separator such as Today"),
        }),
      )
      .min(1),
  })
  .describe("A conversation to render as a Telegram chat");

server.registerTool(
  "frame_screenshot",
  {
    title: "Frame a screenshot",
    description:
      "Capture a web page (or take an existing image) and draw it inside a macOS Safari window or an iPhone on a coloured canvas, sized for social posts. Writes an image file and returns its path, size and a small preview. Give two sources for a composition: two phones, or devices ['desktop','phone'] for a window with a phone in front. Set frames to ['telegram-app'] for a Telegram Mini App header around the page, or ['telegram-chat'] for a Telegram chat (around a picture, or rendering a conversation given as a source). Call list_presets for the preset, canvas, frame and wallpaper names.",
    inputSchema: {
      sources: z
        .array(z.union([z.string(), conversation]))
        .min(1)
        .max(2)
        .describe(
          "One or two sources. Each is a URL (http://localhost:3000/pricing), a path to an image, a path to a conversation .json, or a conversation object to render as a Telegram chat",
        ),
      out: z
        .string()
        .describe(
          "Output file, .png, .webp or .jpg, inside the project. Relative paths resolve against cwd",
        ),
      cwd: z
        .string()
        .optional()
        .describe(
          "Project directory: base for relative paths and where shots.config.json is looked up. Defaults to the server's working directory",
        ),
      devices: z
        .array(z.enum(["desktop", "phone"]))
        .min(1)
        .max(2)
        .optional()
        .describe("Device per source (default desktop). One device applies to both sources"),
      preset: z
        .enum(presetNames)
        .optional()
        .describe(
          "x = 16:9, instagram-portrait = 4:5, instagram-square = 1:1, og = 1200x630. Omit for a canvas that hugs the frame",
        ),
      aspect: z.string().optional().describe("Free canvas ratio such as 3:2, instead of a preset"),
      canvas: z
        .string()
        .optional()
        .describe(
          "Background: a built-in or config name, one colour (#0ea5e9), 2-3 comma-separated colours for a glow, a CSS gradient, or 'none' for transparent. Default accent",
        ),
      pad: z.number().optional().describe("Padding around the frame in CSS px (default 120)"),
      shadow: z
        .union([z.enum(Object.keys(SHADOWS)), z.number().min(0).max(2)])
        .optional()
        .describe("Shadow strength (default medium)"),
      tilt: z
        .number()
        .min(-45)
        .max(45)
        .optional()
        .describe("Degrees to turn the frame; two phones fan apart"),
      bar: z
        .string()
        .optional()
        .describe(
          "Address text shown in Safari (default: the URL's host). 'none' draws no Safari chrome",
        ),
      theme: z
        .enum(["auto", "light", "dark"])
        .optional()
        .describe("Safari chrome colour (auto follows the page)"),
      frames: z
        .array(z.enum(["safari", "telegram-app", "telegram-chat", "none"]))
        .min(1)
        .max(2)
        .optional()
        .describe(
          "What is drawn inside each device (default safari; a conversation source defaults to telegram-chat). One value applies to both sources. ['none'] writes the bare capture with no device or canvas",
        ),
      title: z
        .string()
        .optional()
        .describe("Telegram frames: Mini App title or chat name (default: the page's title)"),
      subtitle: z
        .string()
        .optional()
        .describe("Telegram frames: line under the title, e.g. 'mini app', 'bot', 'online'"),
      button: z
        .string()
        .optional()
        .describe("telegram-app: text of the main button under the page"),
      wallpaper: z
        .string()
        .optional()
        .describe(
          "telegram-chat background: telegram (default, follows the theme), telegram-light, telegram-dark, telegram-blue, telegram-rose, telegram-violet, telegram-amber, or anything canvas accepts. The same names work as canvas",
        ),
      avatar: z
        .string()
        .optional()
        .describe("telegram-chat: path to an avatar image (default: initials)"),
      menu: z
        .string()
        .optional()
        .describe("telegram-chat: text of the bot's menu button in the composer"),
      width: z
        .union([z.number(), z.literal("native")])
        .optional()
        .describe("Output width in px. Default is native resolution (og: 1200)"),
      scale: z.number().min(1).max(3).optional().describe("Device pixel ratio (default 2)"),
      quality: z.number().min(1).max(100).optional().describe("WebP/JPEG quality (default 90)"),
      viewport: z
        .string()
        .optional()
        .describe("Desktop page size in CSS px, e.g. 1280x800 (default 1440x900)"),
      scheme: z.enum(["light", "dark"]).optional().describe("Emulated prefers-color-scheme"),
      accept: z
        .string()
        .optional()
        .describe("Click a button with this text before capturing (cookie banner)"),
      scroll: z.number().optional().describe("Scroll this many px down before capturing"),
      wait: z.number().optional().describe("Extra ms to wait before capturing"),
      hide: z.array(z.string()).optional().describe("CSS selectors to hide before capturing"),
      preview: z
        .boolean()
        .optional()
        .describe("Return a small preview image with the result (default true)"),
    },
  },
  async ({ preview = true, ...options }) => {
    try {
      const done = await frameShot(options, { root });
      const content = [{ type: "text", text: JSON.stringify(done) }];
      if (preview) {
        const small = await sharp(done.out)
          .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 70 })
          .toBuffer();
        content.push({ type: "image", data: small.toString("base64"), mimeType: "image/webp" });
      }
      return { content };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: error.message }] };
    }
  },
);

server.registerTool(
  "list_presets",
  {
    title: "List presets and canvases",
    description:
      "The social presets, canvases (backgrounds), devices and shadow strengths frame_screenshot accepts, including brand canvases and defaults from the project's shots.config.json.",
    inputSchema: {
      cwd: z.string().optional().describe("Project directory to read shots.config.json from"),
    },
  },
  async ({ cwd }) => {
    try {
      const dir = path.resolve(cwd ?? process.cwd());
      if (root) await assertInside(root, dir, "cwd");
      const config = await loadConfig(dir);
      const listing = {
        presets: Object.fromEntries(
          Object.entries(PRESETS).map(([name, p]) => [
            name,
            { label: p.label, aspect: p.aspect.join(":"), minimum: p.min.join("x") },
          ]),
        ),
        canvases: { builtIn: Object.keys(CANVASES), config: Object.keys(config.canvases) },
        devices: ["desktop", "phone"],
        frames: ["safari", "telegram-app", "telegram-chat", "none"],
        wallpapers: ["telegram", ...Object.keys(WALLPAPERS)],
        compositions: [
          "one device",
          "two phones",
          "desktop with phone",
          "desktop telegram-chat with a telegram-app window in front",
        ],
        shadows: Object.keys(SHADOWS),
        configDefaults: config.defaults,
        configFiles: config.files,
      };
      return { content: [{ type: "text", text: JSON.stringify(listing, null, 2) }] };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: error.message }] };
    }
  },
);

await server.connect(new StdioServerTransport());
