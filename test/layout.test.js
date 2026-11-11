import assert from "node:assert/strict";
import { test } from "node:test";

import { classifySource } from "../src/index.js";
import { arrange, canvasSize, rotatedSize } from "../src/layout.js";
import { CANVASES, parseAspect, resolveCanvas, resolveShadow } from "../src/presets.js";

const phone = { device: "phone", width: 421, height: 880 };
const desktop = { device: "desktop", width: 1440, height: 952 };

test("one frame fills the stage", () => {
  const stage = arrange([desktop]);
  assert.equal(stage.width, 1440);
  assert.equal(stage.height, 952);
  assert.deepEqual(stage.items[0], { cx: 720, cy: 476, scale: 1, rotate: 0, z: 1 });
});

test("two phones sit side by side, the second lower", () => {
  const stage = arrange([phone, phone]);
  assert.equal(stage.width, 421 * 2 + 59);
  assert.equal(stage.height, 880 + 28);
  assert.ok(stage.items[1].cy > stage.items[0].cy);
});

test("a tilted pair fans apart and needs more room", () => {
  const flat = arrange([phone, phone]);
  const fan = arrange([phone, phone], 6);
  assert.equal(fan.items[0].rotate, -6);
  assert.equal(fan.items[1].rotate, 6);
  assert.ok(fan.width > flat.width && fan.height > flat.height);
});

test("a phone in front of a desktop sticks out of its corner", () => {
  const stage = arrange([desktop, phone]);
  assert.equal(stage.width, 1440 + 70);
  assert.equal(stage.height, 952 + 50);
  assert.equal(stage.items[1].z, 2);
  // the order of the sources does not matter
  assert.equal(arrange([phone, desktop]).width, stage.width);
});

test("two desktops are refused", () => {
  assert.throws(() => arrange([desktop, desktop]), /Two desktops/);
});

test("the canvas grows to the aspect, never shrinks", () => {
  assert.deepEqual(canvasSize({ width: 1440, height: 952 }, 120, [16, 9]), {
    width: 2119,
    height: 1192,
  });
  assert.deepEqual(canvasSize({ width: 421, height: 880 }, 120, [1, 1]), {
    width: 1120,
    height: 1120,
  });
  assert.deepEqual(canvasSize({ width: 100, height: 100 }, 10, null), { width: 120, height: 120 });
});

test("a rotated box is larger", () => {
  const size = rotatedSize(100, 50, 90);
  assert.ok(Math.abs(size.width - 50) < 1e-9 && Math.abs(size.height - 100) < 1e-9);
});

test("canvases: names, colours, glows, config", () => {
  assert.equal(resolveCanvas("accent"), CANVASES.accent);
  assert.equal(resolveCanvas(undefined), CANVASES.accent);
  assert.equal(resolveCanvas("none"), "transparent");
  assert.equal(resolveCanvas("#0ea5e9"), "#0ea5e9");
  assert.equal(resolveCanvas("rgb(1, 2, 3)"), "rgb(1, 2, 3)");
  assert.match(resolveCanvas("#fff,#000"), /^radial-gradient\(.*#fff 0%, #000 100%\)$/);
  assert.match(resolveCanvas("brand", { brand: ["#fff0a6", "#e9c60b", "#a38700"] }), /#e9c60b 48%/);
  assert.equal(resolveCanvas("night", { night: "#0b1020" }), "#0b1020");
  assert.equal(resolveCanvas("linear-gradient(#fff, #000)"), "linear-gradient(#fff, #000)");
  assert.throws(() => resolveCanvas("no such thing"), /Unknown canvas/);
  assert.throws(() => resolveCanvas("red; } body { display: none"), /not a colour/);
});

test("shadow and aspect parsing", () => {
  assert.equal(resolveShadow("none"), 0);
  assert.equal(resolveShadow("1.2"), 1.2);
  assert.throws(() => resolveShadow("huge"));
  assert.deepEqual(parseAspect("4:5"), [4, 5]);
  assert.throws(() => parseAspect("wide"));
});

test("sources: URLs, bare hosts and files", () => {
  const cwd = import.meta.dirname;
  assert.deepEqual(classifySource("https://example.com/a", cwd), {
    kind: "url",
    url: "https://example.com/a",
  });
  assert.equal(classifySource("localhost:3000/pricing", cwd).url, "http://localhost:3000/pricing");
  assert.equal(classifySource("example.com", cwd).url, "https://example.com");
  assert.equal(classifySource("layout.test.js", cwd).kind, "image");
  assert.throws(() => classifySource("missing.png", cwd), /no such image/);
});
