/**
 * Chat wallpapers in the manner of Telegram's: four soft colours meeting in
 * the middle, with a tile of small line doodles over them. The doodles are
 * drawn here (stars, hearts, clouds, …), not taken from Telegram. Each
 * wallpaper is one CSS `background` value, so it works inside a chat frame
 * and as a canvas.
 */

// One 240×240 tile. Everything is a stroke, so one colour themes it.
const DOODLES = `
  <path d="M30 22l4 9 10 1-7.5 6.5 2.3 9.5L30 43l-8.8 5 2.3-9.5L16 32l10-1z"/>
  <path d="M96 30c-5-7-16-3-14 6 1 6 8 10 14 15 6-5 13-9 14-15 2-9-9-13-14-6z"/>
  <circle cx="168" cy="34" r="11"/><circle cx="168" cy="34" r="4"/>
  <path d="M206 20c8 3 12 12 9 20M222 26l-6 14-13-7"/>
  <path d="M18 92c6-8 14 8 20 0s14 8 20 0"/>
  <path d="M92 84h26a8 8 0 0 1 0 16H98a10 10 0 0 1-2-19.8A12 12 0 0 1 118 84"/>
  <path d="M160 78l14 24h-28z"/>
  <path d="M214 82v20M204 92h20"/>
  <path d="M40 140a16 16 0 1 0 14 24 13 13 0 0 1-14-24z"/>
  <rect x="88" y="138" width="26" height="20" rx="5"/><path d="M94 158l-2 8 9-8"/>
  <path d="M152 164l8-26 5 11 11-5-8 26-5-11z"/>
  <circle cx="212" cy="150" r="3"/><circle cx="226" cy="162" r="2"/><circle cx="202" cy="168" r="2"/>
  <path d="M22 204l8 8 16-18"/>
  <path d="M84 222c2-12 10-20 22-22-2 12-10 20-22 22zM84 222l10-10"/>
  <path d="M150 200h24M150 210h16M150 220h20"/>
  <path d="M204 216c0-8 6-14 13-14s13 6 13 14M204 216h26M217 202v-5"/>`;

function tile(stroke, opacity) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${DOODLES}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 0 0 / 240px 240px repeat`;
}

/** Four colours, one in each corner, over a base. */
function mesh([a, b, c, d], base) {
  const spot = (at, colour) => `radial-gradient(circle at ${at}, ${colour} 0%, transparent 72%)`;
  return [
    spot("0% 0%", a),
    spot("100% 0%", b),
    spot("100% 100%", c),
    spot("0% 100%", d),
    `linear-gradient(${base}, ${base})`,
  ].join(", ");
}

const light = (colours, base) => `${tile("#000", 0.09)}, ${mesh(colours, base)}`;

export const WALLPAPERS = {
  "telegram-light": light(["#dbddbb", "#6ba587", "#d5d88d", "#88b884"], "#a9c48f"),
  "telegram-dark": `${tile("#fff", 0.06)}, ${mesh(["#1b2836", "#0f1720", "#182330", "#0d141c"], "#111a23")}`,
  "telegram-blue": light(["#cfe2f7", "#8db7e6", "#b9d3f1", "#9fc3ec"], "#a9c8ee"),
  "telegram-rose": light(["#f8d9e0", "#eaa5bd", "#f6d5c6", "#e9b3c9"], "#efbfce"),
  "telegram-violet": light(["#d8ccf5", "#9c8be0", "#c7b8f0", "#a998e6"], "#b3a3ea"),
  "telegram-amber": light(["#f9e6ae", "#f0b96a", "#f7dc9a", "#eec47a"], "#f3cf8a"),
};

/** The wallpaper `telegram` follows the theme. */
export function wallpaperName(name, dark) {
  if (!name || name === "telegram") return dark ? "telegram-dark" : "telegram-light";
  return name;
}
