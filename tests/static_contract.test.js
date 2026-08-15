"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");

test("demo and both Cloud Run copies are byte-identical", () => {
  const demo = fs.readFileSync(path.join(ROOT, "demo", "kisanflow_demo.html"));
  assert.deepEqual(fs.readFileSync(path.join(ROOT, "cloud-run", "index.html")), demo);
  assert.deepEqual(fs.readFileSync(path.join(ROOT, "cloud-run", "static", "index.html")), demo);
});

test("jury UI contains the challenge and safety contracts", () => {
  const html = fs.readFileSync(path.join(ROOT, "demo", "kisanflow_demo.html"), "utf8");
  for (const claim of ["26-week", "P10", "P50", "P90", "Synthetic case", "Sandbox schemas", "Maker–checker", "No autonomous execution", "model_artifact.js"]) {
    assert.ok(html.includes(claim), `missing UI contract: ${claim}`);
  }
  assert.ok(!/12-month|auto-approved|five-agent/i.test(html));
});

test("free-tier deployment remains bounded", () => {
  const script = fs.readFileSync(path.join(ROOT, "cloud-run", "deploy-free-tier.sh"), "utf8");
  for (const flag of ["--min-instances 0", "--max-instances 1", "--memory 256Mi", "--cpu-throttling", "--no-cpu-boost"]) assert.ok(script.includes(flag));
});
