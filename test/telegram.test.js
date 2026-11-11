import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { classifySource, resolveOptions } from "../src/index.js";
import { arrange } from "../src/layout.js";
import { CANVASES, resolveCanvas } from "../src/presets.js";
import {
  formatText,
  telegramApp,
  telegramChat,
  telegramView,
  validateChat,
} from "../src/telegram.js";
import { WALLPAPERS, wallpaperName } from "../src/wallpapers.js";

const chat = { messages: [{ from: "me", text: "hi" }] };
let dir;
before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "shots-tg-"));
  await mkdir(path.join(dir, "in"));
  await writeFile(path.join(dir, "in", "chat.json"), JSON.stringify(chat));
  await writeFile(path.join(dir, "in", "a.png"), "");
});
after(() => rm(dir, { recursive: true, force: true }));

test("views leave room for Telegram's chrome", () => {
  assert.deepEqual(telegramView("telegram-app", "phone"), { width: 393, height: 742 });
  assert.deepEqual(telegramView("telegram-app", "phone", { button: "Pay" }), {
    width: 393,
    height: 658,
  });
  assert.deepEqual(telegramView("telegram-app", "desktop"), { width: 420, height: 680 });
  assert.deepEqual(telegramView("telegram-chat", "phone"), { width: 393, height: 664 });
  assert.deepEqual(telegramView("telegram-chat", "desktop"), { width: 740, height: 582 });
});

test("message text is escaped, then formatted", () => {
  assert.equal(formatText("<b>x</b>"), "&lt;b&gt;x&lt;/b&gt;");
  assert.equal(formatText("**bold** and `code`"), "<b>bold</b> and <code>code</code>");
  assert.equal(formatText("a\nb"), "a<br>b");
  assert.match(formatText("try /help or @some_bot"), /<span class="link">\/help<\/span>/);
  assert.match(
    formatText("see https://example.com/a?b=1 now"),
    /link">https:\/\/example\.com\/a\?b=1</,
  );
  // a slash inside a path is not a command
  assert.doesNotMatch(formatText("a/bcd"), /link/);
});

test("conversations are validated", () => {
  assert.equal(validateChat(chat), chat);
  assert.throws(() => validateChat({}), /needs "messages"/);
  assert.throws(() => validateChat({ messages: [{ from: "bot", text: "x" }] }), /"me" or "them"/);
  assert.throws(() => validateChat({ messages: [{ from: "me" }] }), /"text" or "image"/);
  validateChat({ messages: [{ date: "Today" }, { from: "them", image: "a.png" }] });
});

test("the frames draw titles, buttons and bubbles, escaped", () => {
  const tint = { css: "rgb(255, 255, 255)", dark: false };
  const view = telegramView("telegram-app", "phone", { button: "Pay" });
  const app = telegramApp({
    device: "phone",
    src: "data:,",
    view,
    tint,
    title: "Shop <1>",
    subtitle: "mini app",
    button: "Pay",
    dark: false,
    shadow: 1,
  });
  assert.equal(app.width, 421);
  assert.match(app.html, /Shop &lt;1&gt;/);
  assert.match(app.html, /class="main">Pay</);

  const window = telegramApp({
    device: "desktop",
    src: "data:,",
    view: { width: 420, height: 680 },
    tint,
    title: "Shop",
    dark: false,
    shadow: 1,
  });
  assert.deepEqual([window.width, window.height], [420, 728]);

  const drawn = telegramChat({
    device: "desktop",
    src: null,
    chat: {
      messages: [
        { date: "Today" },
        { from: "them", text: "<script>", buttons: [["A", "B"], ["C"]] },
        { from: "me", text: "ok" },
      ],
    },
    view: telegramView("telegram-chat", "desktop"),
    title: "Tune Fetch",
    subtitle: "bot",
    avatarSrc: null,
    wallpaper: WALLPAPERS["telegram-light"],
    menu: "Open",
    dark: false,
    shadow: 1,
  });
  assert.deepEqual([drawn.width, drawn.height], [1040, 720]);
  assert.match(drawn.html, /&lt;script&gt;/);
  assert.doesNotMatch(drawn.html, /<script>/);
  assert.equal(drawn.html.match(/class="keys"/g).length, 2);
  assert.match(drawn.html, />TF</); // initials avatar
  assert.match(drawn.html, /class="botmenu">Open</);
});

test("wallpapers are canvases too", () => {
  assert.equal(wallpaperName(undefined, false), "telegram-light");
  assert.equal(wallpaperName("telegram", true), "telegram-dark");
  assert.equal(wallpaperName("telegram-rose", true), "telegram-rose");
  for (const name of Object.keys(WALLPAPERS)) {
    assert.equal(resolveCanvas(name), WALLPAPERS[name]);
    assert.equal(CANVASES[name], WALLPAPERS[name]);
    assert.doesNotMatch(WALLPAPERS[name], /[;{}<>]/);
  }
});

test("sources and frames: conversations default to the chat frame", async () => {
  assert.equal(classifySource("in/chat.json", dir).kind, "chat");
  assert.equal(classifySource(chat, dir).kind, "chat");

  const o = await resolveOptions({ cwd: dir, sources: ["in/chat.json"], out: "o.png" });
  assert.deepEqual(o.frames, ["telegram-chat"]);
  const two = await resolveOptions({
    cwd: dir,
    sources: [chat, "in/a.png"],
    frame: "telegram-chat,telegram-app",
    device: "desktop",
    out: "o.png",
  });
  assert.deepEqual(two.frames, ["telegram-chat", "telegram-app"]);
  assert.deepEqual(
    (await resolveOptions({ cwd: dir, sources: ["in/a.png"], out: "o.png" })).frames,
    ["safari"],
  );
  assert.equal(
    (await resolveOptions({ cwd: dir, sources: ["in/a.png"], frame: "none", out: "o.png" })).bare,
    true,
  );
  await assert.rejects(
    resolveOptions({ cwd: dir, sources: ["in/chat.json"], frame: "safari", out: "o.png" }),
    /telegram-chat/,
  );
  await assert.rejects(
    resolveOptions({ cwd: dir, sources: ["in/a.png"], frame: "whatsapp", out: "o.png" }),
    /--frame must be/,
  );
});

test("the guard covers conversation files and avatars", async () => {
  const root = path.join(dir, "in");
  await resolveOptions({ cwd: root, sources: ["chat.json"], avatar: "a.png", out: "o.png" }, root);
  await assert.rejects(
    resolveOptions({ cwd: root, sources: ["chat.json"], avatar: "../x.png", out: "o.png" }, root),
    /avatar is outside/,
  );
});

test("a desktop Mini App window pairs like a phone", () => {
  const app = { device: "desktop", small: true, width: 420, height: 728 };
  const chatWindow = { device: "desktop", small: false, width: 1040, height: 720 };
  assert.equal(arrange([app, app]).width, 420 * 2 + 59);
  const stage = arrange([chatWindow, app]);
  assert.equal(stage.items[1].z, 2);
  assert.equal(stage.items[1].scale, 0.78);
});
