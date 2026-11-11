/**
 * The drawn devices: a macOS Safari window and an iPhone with Safari, plus
 * the bare iPhone and window that other chrome (Telegram) is drawn into. Each
 * returns `{ html, css, width, height }` in CSS px. The CSS is written to be
 * nested under a per-frame class, so two frames can share one page.
 */
import { MAC, PHONE } from "./presets.js";

export const ICON = (body, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICONS = {
  sidebar: ICON('<rect x="2.5" y="4" width="15" height="12" rx="2.5"/><path d="M7.5 4v12"/>'),
  back: ICON('<path d="M12 4.5 6.5 10l5.5 5.5"/>'),
  forward: ICON('<path d="M8 4.5 13.5 10 8 15.5"/>'),
  share: ICON(
    '<path d="M10 12V3M6.8 6 10 2.8 13.2 6M5.5 9H5a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 15 9h-.5"/>',
  ),
  plus: ICON('<path d="M10 4v12M4 10h12"/>'),
  tabs: ICON(
    '<rect x="6" y="2.8" width="11" height="11" rx="2.5"/><path d="M3.5 6.5v7A3.5 3.5 0 0 0 7 17h7"/>',
  ),
  reload: ICON('<path d="M15.5 10a5.5 5.5 0 1 1-1.9-4.2M15 2.8v3.4h-3.4"/>', 18),
  lock: ICON(
    '<rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.8a3 3 0 0 1 6 0V9"/>',
    12,
  ),
};

export const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

/** Two stacked drop shadows; `strength` scales their opacity (0 = none). */
export function shadow(strength) {
  if (!strength) return "";
  const a = (base) => Math.min(base * strength, 0.9).toFixed(3);
  return `, 0 70px 100px -30px rgba(0,0,0,${a(0.55)}), 0 28px 44px -22px rgba(0,0,0,${a(0.4)})`;
}

/** The area a page fills inside each device, in CSS px. */
export function viewOf(device, { chrome = true, viewport } = {}) {
  if (device === "phone") {
    return { width: PHONE.width, height: PHONE.height - PHONE.status - (chrome ? PHONE.bar : 0) };
  }
  return viewport ?? { width: MAC.width, height: MAC.height };
}

/**
 * @param {object} o
 * @param {string} o.src      image URL (a data URL) of the page
 * @param {{width:number,height:number}} o.view  size the page is shown at
 * @param {string|null} o.address  text in the address pill; null draws no toolbar
 * @param {boolean} o.dark    dark Safari toolbar
 * @param {number} o.shadow   shadow strength
 */
export function macWindow({ src, view, address, dark, shadow: strength }) {
  const chrome = address !== null;
  const toolbar = chrome
    ? `<div class="toolbar">
        <div class="left">
          <i class="light" style="background:#ff5f57"></i><i class="light" style="background:#febc2e"></i><i class="light" style="background:#28c840"></i>
          <span class="ico" style="margin-left:18px">${ICONS.sidebar}</span>
          <span class="ico" style="margin-left:14px">${ICONS.back}</span>
          <span class="ico dim">${ICONS.forward}</span>
        </div>
        <div class="pill">${escapeHtml(address)}<span class="reload">${ICONS.reload}</span></div>
        <div class="right"><span class="ico">${ICONS.share}</span><span class="ico">${ICONS.plus}</span><span class="ico">${ICONS.tabs}</span></div>
      </div>`
    : "";
  const width = view.width;
  const height = view.height + (chrome ? MAC.toolbar : 0);
  const t = dark
    ? { bar: "linear-gradient(#3b3b3e, #2f2f32)", line: "rgba(0,0,0,.55)", ink: "#a9a9b0" }
    : { bar: "linear-gradient(#f8f7f7, #efeeee)", line: "rgba(0,0,0,.12)", ink: "#62626a" };
  const pill = dark
    ? { bg: "rgba(255,255,255,.1)", ink: "#f2f2f7", reload: "#a9a9b0" }
    : { bg: "rgba(0,0,0,.06)", ink: "#2b2b2e", reload: "#6a6a70" };
  const css = `
    .win { width: ${width}px; height: ${height}px; border-radius: 18px; overflow: hidden; background: #fff;
      box-shadow: 0 0 0 1px rgba(0,0,0,.14)${shadow(strength)}; }
    .toolbar { height: ${MAC.toolbar}px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
      background: ${t.bar}; border-bottom: 1px solid ${t.line}; color: ${t.ink}; }
    .left, .right { display: flex; align-items: center; padding: 0 20px; }
    .right { justify-content: flex-end; gap: 24px; }
    .light { width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; box-shadow: inset 0 0 0 .5px rgba(0,0,0,.2); }
    .ico { display: inline-flex; } .dim { opacity: .35; margin-left: 10px; }
    .pill { width: ${Math.min(520, Math.round(width * 0.36))}px; height: 32px; border-radius: 10px; background: ${pill.bg}; position: relative;
      display: grid; place-items: center; font-size: 14px; font-weight: 500; color: ${pill.ink}; white-space: nowrap; }
    .reload { position: absolute; right: 10px; top: 7px; color: ${pill.reload}; display: inline-flex; }
    .page { display: block; width: ${view.width}px; height: ${view.height}px; object-fit: cover; object-position: top; }`;
  return {
    css,
    width,
    height,
    html: `<div class="win">${toolbar}<img class="page" src="${src}"></div>`,
  };
}

/**
 * The phone's body. `titanium` has a grey rim that catches the light; `black`
 * has none, only a faint inner highlight so the phone keeps its outline on a
 * dark canvas.
 */
export const FINISHES = {
  titanium: {
    body: "linear-gradient(145deg, #55555a, #1d1d1f 55%, #3c3c40)",
    button: "#2c2c2e",
    edge: "",
  },
  black: {
    body: "linear-gradient(145deg, #1b1b1d, #0a0a0b 55%, #131314)",
    button: "#0e0e0f",
    edge: "inset 0 0 0 1px rgba(255,255,255,.07), ",
  },
};

/**
 * An iPhone with a status bar and nothing else on its screen. The screen is
 * black behind its content, so no light edge shows at the rounded corners of
 * a dark page.
 * @param {object} o
 * @param {string} o.screen   HTML placed on the screen, under the status bar
 * @param {string} o.css      CSS for that HTML
 * @param {string} o.statusBg status bar background (a CSS colour)
 * @param {boolean} o.statusDark  true for white status bar text
 * @param {string} o.home     colour of the home indicator
 * @param {number} o.shadow
 * @param {"titanium"|"black"} [o.finish]  colour of the body and side buttons
 */
export function phoneShell({
  screen,
  css,
  statusBg,
  statusDark,
  home,
  shadow: strength,
  finish = "titanium",
}) {
  const metal = FINISHES[finish] ?? FINISHES.titanium;
  const { width, height, status, bezel } = PHONE;
  const outer = { width: width + bezel * 2, height: height + bezel * 2 };
  const shell = `
    .wrap { position: relative; width: ${outer.width}px; height: ${outer.height}px; }
    .btn { position: absolute; width: 4px; background: ${metal.button}; border-radius: 2px; }
    .body { width: 100%; height: 100%; border-radius: 68px; padding: 5px;
      background: ${metal.body};
      box-shadow: ${metal.edge}0 0 0 1px rgba(0,0,0,.4)${shadow(strength)}; }
    .glass { width: 100%; height: 100%; border-radius: 63px; background: #000; padding: ${bezel - 5}px; }
    .screen { position: relative; width: ${width}px; height: ${height}px; border-radius: 54px; overflow: hidden; background: #000; }
    .status { position: absolute; inset: 0 0 auto 0; height: ${status}px; background: ${statusBg}; color: ${statusDark ? "#fff" : "#000"};
      display: flex; justify-content: space-between; align-items: center; padding: 8px 34px 0 52px; z-index: 3;
      font-size: 17px; font-weight: 600; letter-spacing: -.2px; }
    .status .icons { display: flex; align-items: center; gap: 7px; fill: currentColor; }
    .island { position: absolute; top: 11px; left: 50%; width: 124px; height: 36px; margin-left: -62px; border-radius: 20px; background: #000; z-index: 4; }
    .home { position: absolute; left: 50%; bottom: 8px; width: 138px; height: 5px; margin-left: -69px; border-radius: 3px; background: ${home}; z-index: 4; }`;
  const statusBar = `<div class="status"><span>9:41</span><span class="icons">
      <svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
      <svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 2.2c2.3 0 4.4.9 6 2.4l1-1.1C13.6 1.7 11.2.7 8.5.7S3.4 1.7 1.5 3.5l1 1.1c1.6-1.5 3.7-2.4 6-2.4z"/><path d="M8.5 5.9c1.3 0 2.5.5 3.4 1.3l1-1.1c-1.2-1.1-2.7-1.7-4.4-1.7S5.3 5 4.1 6.1l1 1.1c.9-.8 2.1-1.3 3.4-1.3z"/><circle cx="8.5" cy="10" r="1.6"/></svg>
      <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.5"/><path d="M25 4.5v4c.8-.3 1.5-1.2 1.5-2s-.7-1.7-1.5-2z" opacity=".5"/></svg>
    </span></div><div class="island"></div>`;
  const buttons = `<i class="btn" style="left:-3px;top:150px;height:32px"></i><i class="btn" style="left:-3px;top:214px;height:58px"></i><i class="btn" style="left:-3px;top:284px;height:58px"></i><i class="btn" style="right:-3px;top:250px;height:96px"></i>`;
  return {
    css: shell + css,
    ...outer,
    html: `<div class="wrap">${buttons}<div class="body"><div class="glass"><div class="screen">${statusBar}${screen}<div class="home"></div></div></div></div></div>`,
  };
}

/**
 * A plain window: rounded, with a hairline border and the shadow.
 * @param {{width:number,height:number,inner:string,css:string,shadow:number,radius?:number}} o
 */
export function windowShell({ width, height, inner, css, shadow: strength, radius = 14 }) {
  return {
    css: `
    .win { position: relative; width: ${width}px; height: ${height}px; border-radius: ${radius}px; overflow: hidden; background: #fff;
      box-shadow: 0 0 0 1px rgba(0,0,0,.14)${shadow(strength)}; }${css}`,
    width,
    height,
    html: `<div class="win">${inner}</div>`,
  };
}

/**
 * @param {object} o
 * @param {string} o.src
 * @param {{css:string,dark:boolean}} o.tint  colour of the page's top edge; the
 *   status bar continues it, as Safari does
 * @param {string|null} o.address  null draws no Safari bar, only the phone
 * @param {boolean} o.dark  dark Safari bar
 * @param {number} o.shadow
 */
export function iPhone({ src, tint, address, dark, shadow: strength, finish }) {
  const chrome = address !== null;
  const { width, status } = PHONE;
  const view = viewOf("phone", { chrome });
  const barHeight = chrome ? PHONE.bar : 0;
  const bar = dark
    ? { bg: "#1c1c1e", pill: "rgba(118,118,128,.3)", ink: "#fff", dim: "#c7c7cc", home: "#f2f2f7" }
    : {
        bg: "#f2f2f7",
        pill: "rgba(118,118,128,.14)",
        ink: "#1c1c1e",
        dim: "#3a3a3c",
        home: "#111",
      };
  const css = `
    .page { position: absolute; top: ${status}px; left: 0; width: ${width}px; height: ${view.height}px; display: block;
      object-fit: cover; object-position: top; }
    .bar { position: absolute; left: 0; right: 0; bottom: 0; height: ${barHeight}px; background: ${bar.bg}; }
    .bar .pill { margin: 6px 12px 0; height: 44px; border-radius: 15px; background: ${bar.pill};
      display: flex; align-items: center; justify-content: space-between; padding: 0 16px; font-size: 16px; color: ${bar.ink}; }
    .bar .aa { font-size: 15px; color: ${bar.dim}; } .bar .mid { display: flex; align-items: center; gap: 5px; font-weight: 500; white-space: nowrap; }
    .bar .reload { color: ${bar.dim}; display: inline-flex; }`;
  const safari = chrome
    ? `<div class="bar"><div class="pill"><span class="aa">aA</span><span class="mid">${address ? ICONS.lock : ""}${escapeHtml(address)}</span><span class="reload">${ICONS.reload}</span></div></div>`
    : "";
  return phoneShell({
    css,
    screen: `<img class="page" src="${src}">${safari}`,
    statusBg: tint.css,
    statusDark: tint.dark,
    // with no Safari bar the home indicator lies over the page itself
    home: chrome ? bar.home : tint.dark ? "#f2f2f7" : "#111",
    shadow: strength,
    finish,
  });
}
