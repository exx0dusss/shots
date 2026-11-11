/**
 * Telegram chrome, drawn into the same iPhone and window as Safari:
 *
 *   telegram-app   a Mini App: Telegram's header over the page, and an
 *                  optional main button under it
 *   telegram-chat  a chat: header, messages on a wallpaper, composer. The
 *                  messages are a picture (image or capture) or a
 *                  conversation rendered from JSON
 *
 * All of it is drawn here in HTML and CSS; no Telegram artwork is used.
 */
import { ICON, escapeHtml, phoneShell, windowShell } from "./frames.js";
import { PHONE } from "./presets.js";

export const TELEGRAM_FRAMES = ["telegram-app", "telegram-chat"];

const APP_PHONE = { header: 56, button: 84 };
const APP_DESKTOP = { width: 420, height: 680, header: 48, button: 68 };
const CHAT_PHONE = { header: 50, composer: 84 };
const CHAT_DESKTOP = { width: 1040, height: 720, title: 28, side: 300, header: 56, composer: 54 };

const THEMES = {
  light: {
    bar: "#f7f7f7",
    panel: "#ffffff",
    line: "rgba(0,0,0,.12)",
    ink: "#000000",
    dim: "#8e8e93",
    accent: "#3390ec",
    bubbleIn: "#ffffff",
    bubbleOut: "#e1fec6",
    metaOut: "#4fae4e",
    field: "#ffffff",
    fieldLine: "rgba(0,0,0,.12)",
    key: "rgba(70,90,70,.42)",
    service: "rgba(60,80,60,.38)",
    skeleton: "rgba(0,0,0,.08)",
    home: "#111",
  },
  dark: {
    bar: "#1c1c1d",
    panel: "#17212b",
    line: "rgba(255,255,255,.09)",
    ink: "#ffffff",
    dim: "#8d8d93",
    accent: "#5eabf0",
    bubbleIn: "#212b36",
    bubbleOut: "#2b5278",
    metaOut: "rgba(255,255,255,.62)",
    field: "#101820",
    fieldLine: "rgba(255,255,255,.1)",
    key: "rgba(255,255,255,.13)",
    service: "rgba(255,255,255,.13)",
    skeleton: "rgba(255,255,255,.09)",
    home: "#f2f2f7",
  },
};

const I = {
  back: ICON('<path d="M12.5 3.5 6 10l6.5 6.5"/>', 24),
  more: ICON(
    '<circle cx="4.5" cy="10" r="1.3" fill="currentColor"/><circle cx="10" cy="10" r="1.3" fill="currentColor"/><circle cx="15.5" cy="10" r="1.3" fill="currentColor"/>',
  ),
  moreV: ICON(
    '<circle cx="10" cy="4.5" r="1.3" fill="currentColor"/><circle cx="10" cy="10" r="1.3" fill="currentColor"/><circle cx="10" cy="15.5" r="1.3" fill="currentColor"/>',
  ),
  close: ICON('<path d="M5 5l10 10M15 5 5 15"/>'),
  clip: ICON(
    '<path d="M16 9.5 10 15.5a4 4 0 0 1-5.7-5.7l6.5-6.5a2.7 2.7 0 0 1 3.8 3.8L8.2 13.5a1.3 1.3 0 0 1-1.9-1.9l5.7-5.7"/>',
    26,
  ),
  mic: ICON(
    '<rect x="7.5" y="2.5" width="5" height="9" rx="2.5"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5"/>',
    26,
  ),
  smile: ICON(
    '<circle cx="10" cy="10" r="7.2"/><path d="M7 11.8a3.6 3.6 0 0 0 6 0"/><circle cx="7.6" cy="8.2" r=".7" fill="currentColor"/><circle cx="12.4" cy="8.2" r=".7" fill="currentColor"/>',
    22,
  ),
  search: ICON('<circle cx="9" cy="9" r="5.5"/><path d="m13.2 13.2 3.8 3.8"/>'),
  menu: ICON('<path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13"/>'),
  ticks: `<svg width="17" height="10" viewBox="0 0 17 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 5.5 4 8.5 10.5 1.5"/><path d="M7 7.5 8 8.5 14.5 1.5"/></svg>`,
};

/** The area the page or the messages fill, in CSS px. */
export function telegramView(frame, device, { viewport, button } = {}) {
  if (frame === "telegram-app") {
    if (device === "phone") {
      return {
        width: PHONE.width,
        height: PHONE.height - PHONE.status - APP_PHONE.header - (button ? APP_PHONE.button : 0),
      };
    }
    return viewport ?? { width: APP_DESKTOP.width, height: APP_DESKTOP.height };
  }
  if (device === "phone") {
    return {
      width: PHONE.width,
      height: PHONE.height - PHONE.status - CHAT_PHONE.header - CHAT_PHONE.composer,
    };
  }
  const d = CHAT_DESKTOP;
  return { width: d.width - d.side, height: d.height - d.title - d.header - d.composer };
}

/** The width a desktop Mini App window is drawn at, for fitting an image. */
export const APP_DESKTOP_WIDTH = APP_DESKTOP.width;

// ── Mini App ────────────────────────────────────────────────────────────────

/**
 * @param {object} o
 * @param {"phone"|"desktop"} o.device
 * @param {string} o.src  the page
 * @param {{width:number,height:number}} o.view
 * @param {{css:string,dark:boolean}} o.tint  the page's top colour; the header takes it
 * @param {string} o.title
 * @param {string} [o.subtitle]
 * @param {string} [o.button]  text of the main button under the page
 * @param {boolean} o.dark
 * @param {number} o.shadow
 */
export function telegramApp(o) {
  const t = THEMES[o.dark ? "dark" : "light"];
  const ink = o.tint.dark ? "#fff" : "#000";
  const soft = o.tint.dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.07)";
  const dim = o.tint.dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)";
  const title = escapeHtml(o.title);
  const subtitle = o.subtitle ? `<div class="sub">${escapeHtml(o.subtitle)}</div>` : "";
  const button = o.button
    ? `<div class="mainbar"><div class="main">${escapeHtml(o.button)}</div></div>`
    : "";

  if (o.device === "phone") {
    const top = PHONE.status + APP_PHONE.header;
    const css = `
    .head { position: absolute; top: ${PHONE.status}px; left: 0; right: 0; height: ${APP_PHONE.header}px; background: ${o.tint.css}; color: ${ink};
      display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 0 12px; }
    .cap { justify-self: start; height: 32px; padding: 0 14px; border-radius: 16px; background: ${soft};
      display: inline-flex; align-items: center; font-size: 16px; font-weight: 500; }
    .dots { justify-self: end; width: 32px; height: 32px; border-radius: 16px; background: ${soft}; display: grid; place-items: center; }
    .name { text-align: center; font-size: 17px; font-weight: 600; line-height: 1.15; white-space: nowrap; }
    .sub { font-size: 12px; font-weight: 400; color: ${dim}; }
    .page { position: absolute; top: ${top}px; left: 0; width: ${o.view.width}px; height: ${o.view.height}px; display: block;
      object-fit: cover; object-position: top; }
    .mainbar { position: absolute; left: 0; right: 0; bottom: 0; height: ${APP_PHONE.button}px; background: ${o.tint.css}; padding: 8px 16px 0;
      border-top: 1px solid ${soft}; }
    .main { height: 50px; border-radius: 12px; background: ${t.accent}; color: #fff; display: grid; place-items: center;
      font-size: 17px; font-weight: 600; }`;
    return phoneShell({
      css,
      screen: `<div class="head"><span class="cap">Close</span><div class="name">${title}${subtitle}</div><span class="dots">${I.more}</span></div><img class="page" src="${o.src}">${button}`,
      statusBg: o.tint.css,
      statusDark: o.tint.dark,
      home: o.tint.dark ? "#f2f2f7" : "#111",
      shadow: o.shadow,
    });
  }

  const d = APP_DESKTOP;
  const height = d.header + o.view.height + (o.button ? d.button : 0);
  const css = `
    .head { height: ${d.header}px; background: ${o.tint.css}; color: ${ink}; display: flex; align-items: center; gap: 14px; padding: 0 14px 0 18px; }
    .name { flex: 1; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; display: flex; align-items: baseline; gap: 8px; }
    .sub { font-size: 12px; font-weight: 400; color: ${dim}; }
    .ico { display: inline-flex; color: ${dim}; }
    .page { display: block; width: ${o.view.width}px; height: ${o.view.height}px; object-fit: cover; object-position: top; }
    .mainbar { height: ${d.button}px; background: ${o.tint.css}; padding: 10px 14px; border-top: 1px solid ${soft}; }
    .main { height: 48px; border-radius: 10px; background: ${t.accent}; color: #fff; display: grid; place-items: center;
      font-size: 15px; font-weight: 600; }`;
  return windowShell({
    width: o.view.width,
    height,
    css,
    inner: `<div class="head"><div class="name">${title}${subtitle}</div><span class="ico">${I.moreV}</span><span class="ico">${I.close}</span></div><img class="page" src="${o.src}">${button}`,
    shadow: o.shadow,
    radius: 12,
  });
}

// ── Chat ────────────────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  ["#ff885e", "#ff516a"],
  ["#ffcd6a", "#ffa85c"],
  ["#82b1ff", "#665fff"],
  ["#a0de7e", "#54cb68"],
  ["#53edd6", "#28c9b7"],
  ["#72d5fd", "#2a9ef1"],
  ["#e0a2f3", "#d669ed"],
];

/** A round avatar: the picture, or the title's initials on a gradient. */
function avatar(title, src, size) {
  if (src) {
    return `<img class="ava" style="width:${size}px;height:${size}px" src="${src}">`;
  }
  const words = String(title).trim().split(/\s+/).filter(Boolean);
  const initials = (
    words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 1)
  ).toUpperCase();
  const pick = [...String(title)].reduce((sum, c) => sum + c.codePointAt(0), 0);
  const [a, b] = AVATAR_GRADIENTS[pick % AVATAR_GRADIENTS.length];
  return `<span class="ava" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px;background:linear-gradient(${a},${b})">${escapeHtml(initials)}</span>`;
}

/** Message text: escaped, with **bold**, `code`, line breaks, and links, @names and /commands in the accent. */
export function formatText(text) {
  // links first: afterwards the text contains tags of our own, whose "/" must not match
  return escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+|(?<![\w/])[@/][a-zA-Z][\w]{2,})/g, '<span class="link">$1</span>')
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

/** The conversation as HTML: bubbles, day separators, inline keyboards. */
function conversation(chat) {
  return chat.messages
    .map((m) => {
      if (m.date) return `<div class="day"><span>${escapeHtml(m.date)}</span></div>`;
      const out = m.from === "me";
      const meta = `<span class="meta">${escapeHtml(m.time ?? "9:41")}${out ? I.ticks : ""}</span>`;
      const photo = m.imageSrc ? `<img class="photo" src="${m.imageSrc}">` : "";
      const text = m.text
        ? `<div class="text">${formatText(m.text)}${meta}</div>`
        : `<div class="text bare">${meta}</div>`;
      const keys = (m.buttons ?? [])
        .map(
          (row) =>
            `<div class="keys">${[row]
              .flat()
              .map((k) => `<span>${escapeHtml(k)}</span>`)
              .join("")}</div>`,
        )
        .join("");
      return `<div class="row ${out ? "out" : "in"}"><div class="group"><div class="bubble${photo ? " media" : ""}">${photo}${text}</div>${keys}</div></div>`;
    })
    .join("");
}

function chatCss(t, wallpaper, big) {
  const font = big ? 17 : 14.5;
  return `
    .ava { border-radius: 50%; display: inline-grid; place-items: center; color: #fff; font-weight: 600; object-fit: cover; flex: none; }
    .area { background: ${wallpaper}; overflow: hidden; }
    .shot { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
    .msgs { height: 100%; display: flex; flex-direction: column; justify-content: flex-end; gap: ${big ? 6 : 5}px; padding: ${big ? "10px 10px" : "12px 18px"}; }
    .row { display: flex; } .row.out { justify-content: flex-end; }
    .group { display: inline-flex; flex-direction: column; gap: 4px; max-width: ${big ? 80 : 62}%; }
    .bubble { border-radius: ${big ? 18 : 14}px; padding: ${big ? "7px 12px 8px" : "6px 11px 7px"}; font-size: ${font}px; line-height: 1.3; color: ${t.ink};
      background: ${t.bubbleIn}; box-shadow: 0 1px 1px rgba(0,0,0,.12); overflow: hidden; }
    .row.in .bubble { border-bottom-left-radius: 6px; } .row.out .bubble { border-bottom-right-radius: 6px; background: ${t.bubbleOut}; }
    .group:has(.media) { max-width: ${big ? 290 : 340}px; }
    .bubble.media { padding: 0; } .bubble.media .text { padding: ${big ? "7px 12px 8px" : "6px 11px 7px"}; }
    .photo { display: block; width: 100%; max-height: ${big ? 300 : 260}px; object-fit: cover; }
    .text b { font-weight: 600; } .text code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: .9em; }
    .link { color: ${t.accent}; }
    .meta { float: right; margin: ${big ? "7px 0 -3px 12px" : "6px 0 -3px 10px"}; font-size: ${big ? 12 : 11}px; color: ${t.dim}; display: inline-flex; align-items: center; gap: 3px; }
    .row.out .meta { color: ${t.metaOut}; }
    .text.bare { padding: 0 10px 6px; }
    .keys { display: flex; gap: 4px; }
    .keys span { flex: 1; text-align: center; padding: ${big ? "11px 8px" : "9px 8px"}; border-radius: ${big ? 10 : 8}px; background: ${t.key}; color: #fff;
      font-size: ${big ? 15 : 13.5}px; font-weight: 500; white-space: nowrap; }
    .day { text-align: center; margin: 4px 0; }
    .day span { display: inline-block; padding: 3px 10px; border-radius: 12px; background: ${t.service}; color: #fff; font-size: ${big ? 13 : 12.5}px; font-weight: 500; }`;
}

/**
 * @param {object} o
 * @param {"phone"|"desktop"} o.device
 * @param {string|null} o.src  a picture of the messages, or null with `chat`
 * @param {{messages:object[]}|null} o.chat  a conversation to render
 * @param {{width:number,height:number}} o.view
 * @param {string} o.title
 * @param {string} [o.subtitle]
 * @param {string|null} o.avatarSrc
 * @param {string} o.wallpaper  CSS background
 * @param {string} [o.menu]  text of the bot's menu button in the composer
 * @param {boolean} o.dark
 * @param {number} o.shadow
 */
export function telegramChat(o) {
  const t = THEMES[o.dark ? "dark" : "light"];
  const title = escapeHtml(o.title);
  const subtitle = escapeHtml(o.subtitle ?? "");
  const body = o.src
    ? `<img class="shot" src="${o.src}">`
    : `<div class="msgs">${conversation(o.chat)}</div>`;
  const menu = o.menu ? `<span class="botmenu">${escapeHtml(o.menu)}</span>` : "";
  const online = /online|typing/i.test(o.subtitle ?? "");

  if (o.device === "phone") {
    const top = PHONE.status + CHAT_PHONE.header;
    const css = `${chatCss(t, o.wallpaper, true)}
    .head { position: absolute; top: ${PHONE.status}px; left: 0; right: 0; height: ${CHAT_PHONE.header}px; background: ${t.bar}; color: ${t.ink};
      border-bottom: 1px solid ${t.line}; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 0 10px 4px 4px; }
    .back { color: ${t.accent}; display: inline-flex; }
    .name { text-align: center; font-size: 17px; font-weight: 600; line-height: 1.15; white-space: nowrap; }
    .sub { font-size: 13px; font-weight: 400; color: ${online ? t.accent : t.dim}; }
    .head .ava { justify-self: end; }
    .area { position: absolute; top: ${top}px; left: 0; width: ${o.view.width}px; height: ${o.view.height}px; }
    .composer { position: absolute; left: 0; right: 0; bottom: 0; height: ${CHAT_PHONE.composer}px; background: ${t.bar}; border-top: 1px solid ${t.line};
      display: flex; align-items: flex-start; gap: 8px; padding: 7px 10px 0; color: ${t.dim}; }
    .composer .ico { display: inline-flex; height: 36px; align-items: center; }
    .field { flex: 1; height: 36px; border-radius: 18px; background: ${t.field}; border: 1px solid ${t.fieldLine};
      display: flex; align-items: center; justify-content: space-between; padding: 0 8px 0 14px; font-size: 17px; color: ${t.dim}; }
    .botmenu { height: 36px; padding: 0 14px; border-radius: 18px; background: ${t.accent}; color: #fff; display: inline-flex; align-items: center;
      font-size: 15px; font-weight: 600; }`;
    return phoneShell({
      css,
      screen: `<div class="head"><span class="back">${I.back}</span><div class="name">${title}<div class="sub">${subtitle}</div></div>${avatar(o.title, o.avatarSrc, 38)}</div>
        <div class="area">${body}</div>
        <div class="composer"><span class="ico">${I.clip}</span>${menu}<div class="field">Message<span class="ico">${I.smile}</span></div><span class="ico">${I.mic}</span></div>`,
      statusBg: t.bar,
      statusDark: o.dark,
      home: t.home,
      shadow: o.shadow,
    });
  }

  const d = CHAT_DESKTOP;
  const rows = Array.from({ length: 7 }, (_, i) => {
    const w = [58, 44, 66, 38, 52, 61, 47][i];
    return `<div class="chat"><span class="ava ghost"></span><div class="lines"><i style="width:${w}%"></i><i style="width:${Math.min(88, w + 24)}%"></i></div></div>`;
  }).join("");
  const css = `${chatCss(t, o.wallpaper, false)}
    .win { background: ${t.panel}; color: ${t.ink}; }
    .titlebar { height: ${d.title}px; display: flex; align-items: center; padding: 0 12px; gap: 8px; background: ${t.panel}; border-bottom: 1px solid ${t.line}; }
    .titlebar i { width: 12px; height: 12px; border-radius: 50%; box-shadow: inset 0 0 0 .5px rgba(0,0,0,.2); }
    .cols { display: flex; height: ${d.height - d.title}px; }
    .side { width: ${d.side}px; border-right: 1px solid ${t.line}; background: ${t.panel}; }
    .find { display: flex; align-items: center; gap: 12px; height: ${d.header}px; padding: 0 14px; color: ${t.dim}; }
    .find div { flex: 1; height: 32px; border-radius: 16px; background: ${t.skeleton}; display: flex; align-items: center; padding: 0 14px; font-size: 13.5px; }
    .chat { display: flex; align-items: center; gap: 12px; height: 62px; padding: 0 12px; }
    .chat.on { background: ${t.accent}; color: #fff; }
    .chat .who { font-size: 14px; font-weight: 600; white-space: nowrap; } .chat .last { font-size: 13px; opacity: .8; white-space: nowrap; }
    .ghost { width: 46px; height: 46px; background: ${t.skeleton}; }
    .lines { flex: 1; display: grid; gap: 9px; } .lines i { height: 9px; border-radius: 5px; background: ${t.skeleton}; }
    .main { flex: 1; display: flex; flex-direction: column; }
    .head { height: ${d.header}px; display: flex; align-items: center; gap: 18px; padding: 0 18px; background: ${t.panel}; border-bottom: 1px solid ${t.line}; color: ${t.dim}; }
    .name { flex: 1; font-size: 14.5px; font-weight: 600; color: ${t.ink}; line-height: 1.3; }
    .sub { font-size: 13px; font-weight: 400; color: ${online ? t.accent : t.dim}; }
    .area { height: ${o.view.height}px; }
    .composer { height: ${d.composer}px; display: flex; align-items: center; gap: 14px; padding: 0 16px; background: ${t.panel}; border-top: 1px solid ${t.line}; color: ${t.dim}; font-size: 14.5px; }
    .composer .grow { flex: 1; } .ico { display: inline-flex; }
    .botmenu { height: 30px; padding: 0 12px; border-radius: 15px; background: ${t.accent}; color: #fff; display: inline-flex; align-items: center; font-size: 13px; font-weight: 600; }`;
  const inner = `<div class="titlebar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>
    <div class="cols"><div class="side"><div class="find"><span class="ico">${I.menu}</span><div>Search</div></div>
      <div class="chat on">${avatar(o.title, o.avatarSrc, 46)}<div><div class="who">${title}</div><div class="last">${subtitle || "&nbsp;"}</div></div></div>${rows}</div>
    <div class="main"><div class="head"><div class="name">${title}<div class="sub">${subtitle}</div></div><span class="ico">${I.search}</span><span class="ico">${I.moreV}</span></div>
      <div class="area">${body}</div>
      <div class="composer"><span class="ico">${I.clip}</span>${menu}<span class="grow">Write a message…</span><span class="ico">${I.smile}</span><span class="ico">${I.mic}</span></div></div></div>`;
  return windowShell({
    width: d.width,
    height: d.height,
    css,
    inner,
    shadow: o.shadow,
    radius: 12,
  });
}

/** Check a conversation's shape; throws with the first problem found. */
export function validateChat(chat) {
  if (!chat || !Array.isArray(chat.messages) || !chat.messages.length) {
    throw new Error('A conversation needs "messages": [{ "from": "me" | "them", "text": "…" }, …]');
  }
  chat.messages.forEach((m, i) => {
    if (m.date) return;
    if (m.from !== "me" && m.from !== "them") {
      throw new Error(`messages[${i}].from must be "me" or "them"`);
    }
    if (!m.text && !m.image) throw new Error(`messages[${i}] needs "text" or "image"`);
  });
  return chat;
}
