import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { assertInside, isBlockedHost } from "../src/guard.js";
import { resolveOptions } from "../src/index.js";

let tmp;
let root;
let outside;
before(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), "shots-guard-"));
  root = path.join(tmp, "project");
  outside = path.join(tmp, "elsewhere");
  await mkdir(path.join(root, "img"), { recursive: true });
  await mkdir(outside);
  await writeFile(path.join(root, "img", "a.png"), "");
  await writeFile(path.join(outside, "secret.png"), "");
  await symlink(outside, path.join(root, "link"));
});
after(() => rm(tmp, { recursive: true, force: true }));

test("paths under the root pass, also ones that do not exist yet", async () => {
  await assertInside(root, root, "cwd");
  await assertInside(root, path.join(root, "img", "a.png"), "source");
  await assertInside(root, path.join(root, "new", "deep", "out.png"), "out");
});

test("paths outside the root are refused", async () => {
  await assert.rejects(assertInside(root, path.join(outside, "secret.png"), "source"), /outside/);
  await assert.rejects(assertInside(root, path.join(root, "..", "x.png"), "out"), /outside/);
  await assert.rejects(assertInside(root, `${root}-sibling/x.png`, "out"), /outside/);
  await assert.rejects(assertInside(root, "/etc/x.png", "out"), /outside/);
});

test("a symlink out of the root does not pass", async () => {
  await assert.rejects(
    assertInside(root, path.join(root, "link", "secret.png"), "source"),
    /outside/,
  );
  await assert.rejects(assertInside(root, path.join(root, "link", "new.png"), "out"), /outside/);
});

test("options are checked against the root", async () => {
  const ok = await resolveOptions({ cwd: root, sources: ["img/a.png"], out: "out/a.png" }, root);
  assert.equal(ok.guarded, true);
  await assert.rejects(
    resolveOptions({ cwd: root, sources: ["img/a.png"], out: "../elsewhere/a.png" }, root),
    /out is outside/,
  );
  await assert.rejects(
    resolveOptions({ cwd: root, sources: ["../elsewhere/secret.png"], out: "a.png" }, root),
    /source is outside/,
  );
  await assert.rejects(
    resolveOptions({ cwd: outside, sources: ["secret.png"], out: "a.png" }, root),
    /cwd is outside/,
  );
  await assert.rejects(
    resolveOptions({ cwd: root, sources: ["http://169.254.169.254/latest"], out: "a.png" }, root),
    /Refusing to open/,
  );
  // without a root (the CLI) the same paths are fine
  const cli = await resolveOptions({
    cwd: root,
    sources: ["img/a.png"],
    out: "../elsewhere/a.png",
  });
  assert.equal(cli.guarded, false);
});

test("link-local and metadata hosts are blocked, dev servers are not", () => {
  for (const url of [
    "http://169.254.169.254/latest/meta-data/",
    "http://metadata.google.internal/",
    "http://[fe80::1]/",
    "http://[fd00:ec2::254]/",
    "not a url",
  ]) {
    assert.equal(isBlockedHost(url), true, url);
  }
  for (const url of [
    "http://localhost:3000/",
    "http://127.0.0.1:5173/",
    "http://192.168.1.20:3000/",
    "https://example.com/",
  ]) {
    assert.equal(isBlockedHost(url), false, url);
  }
});
