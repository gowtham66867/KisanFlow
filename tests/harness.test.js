"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { runHarness, validateRequest, runVerifierChecks, REQUIRED_TOOLS } = require("../cloud-run/server.js");

const PASSING_STATE = {
  consent: { financial: true, revoked: false },
  results: {
    forecast: { weeks: 3, p10: [1, 2, 3], p50: [2, 3, 4], p90: [3, 4, 5] },
    market: { status: "available", source: "AGMARKNET-compatible cached fixture", freshness_days: 2 },
    simulation: { status: "counterfactual_not_causal" },
    actionCard: { status: "awaiting_independent_checker", required_next_role: "checker", customer_contacted: false, account_changed: false },
  },
};

function stateWith(mutate) {
  const clone = JSON.parse(JSON.stringify(PASSING_STATE));
  mutate(clone);
  return clone;
}

function request(overrides = {}) {
  return {
    scenario: "dairy_shg",
    intervention: "timing",
    consent: { financial: true, market: true, climate: true, revoked: false },
    actor: { id: "maker-demo", role: "maker" },
    ...overrides,
  };
}

test("rejects prohibited personal fields and invalid consent", () => {
  const errors = validateRequest(request({ phone: "000", consent: { financial: false } }));
  assert.ok(errors.some((item) => item.includes("financial-data consent")));
  assert.ok(errors.some((item) => item.includes("prohibited field")));
});

test("withdrawn consent refuses the run before any tool executes", async () => {
  const { status, payload } = await runHarness(request({ consent: { financial: true, market: true, climate: true, revoked: true } }));
  assert.equal(status, 422);
  assert.equal(payload.error, "contract_rejected");
  assert.ok(payload.errors.some((item) => item.includes("withdrawn")));
  assert.equal(payload.trace, undefined);
});

test("an expired or unparseable consent receipt is refused", async () => {
  const expired = await runHarness(request({ consent: { financial: true, revoked: false, expires_at: "2020-01-01T00:00:00Z" } }));
  assert.equal(expired.status, 422);
  assert.ok(expired.payload.errors.some((item) => item.includes("expired")));
  const garbled = validateRequest(request({ consent: { financial: true, revoked: false, expires_at: "not-a-date" } }));
  assert.ok(garbled.some((item) => item.includes("expired")));
  const future = validateRequest(request({ consent: { financial: true, revoked: false, expires_at: "2099-01-01T00:00:00Z" } }));
  assert.deepEqual(future, []);
});

test("the operator kill switch halts new runs", async () => {
  process.env.KISANFLOW_KILL_SWITCH = "on";
  try {
    const { status, payload } = await runHarness(request());
    assert.equal(status, 503);
    assert.equal(payload.error, "kill_switch_engaged");
  } finally {
    delete process.env.KISANFLOW_KILL_SWITCH;
  }
  const resumed = await runHarness(request());
  assert.equal(resumed.status, 200);
});

test("offline harness is bounded and stops at an independent checker", async () => {
  delete process.env.GEMINI_API_KEY;
  const { status, payload } = await runHarness(request());
  assert.equal(status, 200);
  assert.equal(payload.execution_mode, "offline_policy_runner");
  assert.ok(payload.budgets.tools_used <= payload.budgets.max_tools);
  assert.equal(payload.results.actionCard.status, "awaiting_independent_checker");
  assert.equal(payload.results.actionCard.customer_contacted, false);
  assert.equal(payload.results.actionCard.account_changed, false);
  assert.equal(payload.approval_gate.status, "locked");
  assert.equal(payload.verifier.passed, true);
});

test("the verifier executes its checks and can fail each one", () => {
  assert.deepEqual(runVerifierChecks(PASSING_STATE, true), {
    run_complete: true,
    ordered_quantiles: true,
    source_provenance: true,
    consent_valid: true,
    no_autonomous_action: true,
  });
  const crossed = runVerifierChecks(stateWith((s) => { s.results.forecast.p90 = [0, 0, 0]; }), true);
  assert.equal(crossed.ordered_quantiles, false);
  const short = runVerifierChecks(stateWith((s) => { s.results.forecast.p50 = [2, 3]; }), true);
  assert.equal(short.ordered_quantiles, false);
  const unsourced = runVerifierChecks(stateWith((s) => { delete s.results.market.freshness_days; }), true);
  assert.equal(unsourced.source_provenance, false);
  const withdrawn = runVerifierChecks(stateWith((s) => { s.consent.revoked = true; }), true);
  assert.equal(withdrawn.consent_valid, false);
  const contacted = runVerifierChecks(stateWith((s) => { s.results.actionCard.customer_contacted = true; }), true);
  assert.equal(contacted.no_autonomous_action, false);
  const causal = runVerifierChecks(stateWith((s) => { s.results.simulation.status = "proven_uplift"; }), true);
  assert.equal(causal.no_autonomous_action, false);
});

test("every fixture produces ordered 26-week quantiles that the verifier accepts", async () => {
  for (const scenario of ["dairy_shg", "millet_enterprise", "fpo"]) {
    const { status, payload } = await runHarness(request({ scenario }));
    assert.equal(status, 200, scenario);
    assert.equal(payload.verifier.passed, true, scenario);
    assert.deepEqual(payload.verifier.failed_checks, [], scenario);
    assert.equal(payload.results.forecast.p10.length, 26, scenario);
  }
});

test("all eight allow-listed tools execute and no action tool exists", async () => {
  const { payload } = await runHarness(request());
  const executed = payload.trace.filter((item) => item.type === "tool" && item.status === "completed").map((item) => item.tool);
  assert.deepEqual(executed, REQUIRED_TOOLS);
  assert.ok(!REQUIRED_TOOLS.some((name) => /(sanction|reject|contact|restructure|disburse)/i.test(name)));
});

test("replay fingerprint and idempotency key are stable for the same fixture", async () => {
  const first = (await runHarness(request())).payload;
  const second = (await runHarness(request())).payload;
  assert.equal(first.replay_fingerprint, second.replay_fingerprint);
  assert.equal(first.idempotency_key, second.idempotency_key);
});
