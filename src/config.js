/**
 * Optional config: `shots.config.json` in the project (found by walking up
 * from the working directory) over `~/.config/shots/config.json` for
 * everything else. It holds brand canvases and default options:
 *
 *   {
 *     "canvases": { "brand": ["#fff0a6", "#e9c60b", "#a38700"], "night": "#0b1020" },
 *     "defaults": { "canvas": "brand", "bar": "example.com", "pad": 100 }
 *   }
 */
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const CONFIG_NAME = "shots.config.json";

async function readJson(file) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${error.message}`, { cause: error });
  }
}

async function findUp(dir) {
  for (let at = path.resolve(dir); ; at = path.dirname(at)) {
    const file = path.join(at, CONFIG_NAME);
    const json = await readJson(file);
    if (json) return { file, json };
    if (at === path.dirname(at)) return null;
  }
}

/**
 * @param {string} cwd
 * @param {string} [explicit]  a config path given with --config
 * @returns {Promise<{canvases:object, defaults:object, files:string[]}>}
 */
export async function loadConfig(cwd = process.cwd(), explicit) {
  const layers = [];
  const userFile = path.join(os.homedir(), ".config", "shots", "config.json");
  const user = await readJson(userFile);
  if (user) layers.push({ file: userFile, json: user });
  if (explicit) {
    const file = path.resolve(cwd, explicit);
    const json = await readJson(file);
    if (!json) throw new Error(`Config not found: ${file}`);
    layers.push({ file, json });
  } else {
    const project = await findUp(cwd);
    if (project) layers.push(project);
  }
  return {
    canvases: Object.assign({}, ...layers.map((l) => l.json.canvases ?? {})),
    defaults: Object.assign({}, ...layers.map((l) => l.json.defaults ?? {})),
    files: layers.map((l) => l.file),
  };
}
