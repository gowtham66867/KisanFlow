"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const MODEL = JSON.parse(fs.readFileSync(path.join(ROOT, "static", "data", "model_artifact.json"), "utf8"));
const MAX_BODY = 32 * 1024;
const HARNESS_VERSION = "case-manager-1.0.0";
const ALLOWED_SCENARIOS = new Map(MODEL.scenarios.map((scenario) => [scenario.key, scenario]));
const REQUIRED_TOOLS = [
  "validate_case_data",
  "retrieve_market_signal",
  "compute_features",
  "forecast_p10_p50_p90",
  "detect_stress",
  "retrieve_intervention_playbook",
  "simulate_intervention",
  "create_action_card",
];

function json(res, status, value, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...extra });
  res.end(JSON.stringify(value));
}

function headers(contentType) {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  };
}

function safeStaticPath(urlPath) {
  const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const resolved = path.resolve(ROOT, "static", relative);
  const base = path.resolve(ROOT, "static") + path.sep;
  return resolved.startsWith(base) || resolved === path.resolve(ROOT, "static", "index.html") ? resolved : null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw) > MAX_BODY) reject(Object.assign(new Error("request_too_large"), { status: 413 }));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); }
      catch { reject(Object.assign(new Error("invalid_json"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

function event(runId, order, type, tool, status, detail) {
  return { run_id: runId, order, type, tool, status, detail, at: new Date().toISOString() };
}

function consentValid(consent, category) {
  return Boolean(consent && consent[category] === true && consent.revoked !== true && !expiredConsent(consent));
}

// An absent expiry is treated as "not yet dated" rather than valid forever; an unparseable one is refused.
function expiredConsent(consent) {
  if (!consent || consent.expires_at === undefined) return false;
  const expiry = Date.parse(consent.expires_at);
  return Number.isNaN(expiry) || expiry <= Date.now();
}

function killSwitchEngaged() {
  return String(process.env.KISANFLOW_KILL_SWITCH || "").toLowerCase() === "on";
}

function validateRequest(body) {
  const errors = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) errors.push("body must be an object");
  if (!ALLOWED_SCENARIOS.has(body?.scenario)) errors.push("unknown scenario fixture");
  if (!body?.consent || typeof body.consent !== "object") errors.push("consent receipt is required");
  if (body?.consent?.financial !== true) errors.push("financial-data consent is required for an agent run");
  if (body?.consent?.revoked === true) errors.push("consent is withdrawn; no new agent run is permitted");
  if (expiredConsent(body?.consent)) errors.push("consent receipt has expired; re-consent is required");
  if (body?.actor?.role !== "maker") errors.push("run actor must have maker role");
  if (String(body?.actor?.id || "").length < 3) errors.push("actor id is required");
  const forbidden = ["name", "phone", "email", "account_number", "aadhaar", "pan", "prompt"];
  for (const key of forbidden) if (Object.hasOwn(body || {}, key)) errors.push(`prohibited field: ${key}`);
  return errors;
}

async function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try { return await promise(controller.signal); }
  finally { clearTimeout(timeout); }
}

async function planWithGemini(scenario, consent, signal) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { mode: "offline_policy_runner", tools: REQUIRED_TOOLS, reason: "No model key configured; deterministic bounded policy executed." };
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const policy = [
    "You are KisanFlow Case Manager. Select an ordered subset of the provided tool names.",
    "All numbers come from tools. Never sanction, reject, price, restructure, disburse, or contact anyone.",
    "Return strict JSON only: {\"tools\":[...],\"reason\":\"...\"}.",
    `Allowed tools: ${REQUIRED_TOOLS.join(", ")}.`,
    `Synthetic case: ${scenario.key}; enterprise type: ${scenario.enterprise_type}.`,
    `Consent categories: ${Object.keys(consent).filter((keyName) => consent[keyName] === true).join(", ")}.`,
  ].join("\n");
  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: policy }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 300, responseMimeType: "application/json" },
    }),
  });
  if (!response.ok) throw new Error(`model_http_${response.status}`);
  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = JSON.parse(text);
  const selected = Array.isArray(parsed.tools) ? parsed.tools.filter((tool) => REQUIRED_TOOLS.includes(tool)) : [];
  const tools = REQUIRED_TOOLS.filter((tool) => selected.includes(tool) || ["validate_case_data", "forecast_p10_p50_p90", "detect_stress", "create_action_card"].includes(tool));
  return { mode: "llm_case_manager", model, tools, reason: String(parsed.reason || "Bounded model plan validated against allow-list.").slice(0, 240) };
}

async function getPlan(scenario, consent) {
  try { return await withTimeout((signal) => planWithGemini(scenario, consent, signal), 4500); }
  catch (error) {
    return { mode: "offline_policy_runner", tools: REQUIRED_TOOLS, reason: `Model adapter unavailable (${error.message}); deterministic policy runner used.` };
  }
}

function createHarness(body) {
  const scenario = ALLOWED_SCENARIOS.get(body.scenario);
  const runId = crypto.randomUUID();
  const idempotencyKey = crypto.createHash("sha256").update(`${body.scenario}|${body.actor.id}|${MODEL.model_id}|${body.intervention || "timing"}`).digest("hex").slice(0, 20);
  const trace = [];
  const state = { runId, scenario, consent: body.consent, actor: body.actor, intervention: body.intervention || "timing", results: {}, toolCount: 0 };
  function record(tool, status, detail) { trace.push(event(runId, trace.length + 1, "tool", tool, status, detail)); }
  const tools = {
    validate_case_data() {
      const consentStatus = consentValid(state.consent, "financial") ? "valid" : "invalid";
      const result = { schema: "case.v1", consent_status: consentStatus, synthetic_only: true, prohibited_fields: "none" };
      state.results.case = result; return result;
    },
    retrieve_market_signal() {
      const available = consentValid(state.consent, "market");
      const result = available
        ? { status: "available", source: "AGMARKNET-compatible cached fixture", freshness_days: 2, value: 103.4 }
        : { status: "withheld", source: "none", reason: "optional market consent not granted" };
      state.results.market = result; return result;
    },
    compute_features() {
      const result = { feature_contract: "cashflow-weekly.v1", windows: [4, 13, 26, 52], prohibited_features: [] };
      state.results.features = result; return result;
    },
    forecast_p10_p50_p90() {
      const result = { model_id: MODEL.model_id, weeks: 26, p10: scenario.p10, p50: scenario.p50, p90: scenario.p90 };
      state.results.forecast = result; return { model_id: result.model_id, weeks: 26, ordered_intervals: true };
    },
    detect_stress() {
      const result = { ...scenario.stress_window, reason_codes: ["RECEIPTS_4W_DOWN", "INPUT_COST_UP", "RECOVERY_VISIBLE"] };
      state.results.stress = result; return result;
    },
    retrieve_intervention_playbook() {
      const result = { source: "playbook.v1", status: "approved_content", options: scenario.interventions.map((item) => item.key) };
      state.results.playbook = result; return result;
    },
    simulate_intervention() {
      const selected = scenario.interventions.find((item) => item.key === state.intervention) || scenario.interventions[0];
      const result = { ...selected, status: "counterfactual_not_causal", revised_p10: scenario.p10.map((value, index) => index + 1 >= scenario.stress_window.starts_week ? value + selected.p10_uplift : value) };
      state.results.simulation = result; return { key: result.key, p10_uplift: result.p10_uplift, status: result.status };
    },
    create_action_card() {
      const result = {
        action_card_id: `AC-${idempotencyKey.slice(0, 10).toUpperCase()}`,
        status: "awaiting_independent_checker",
        title: "Review temporary liquidity response",
        reasons: state.results.stress?.reason_codes || [],
        proposed_intervention: state.results.simulation?.label || scenario.interventions[0].label,
        customer_contacted: false,
        account_changed: false,
        required_next_role: "checker",
      };
      state.results.actionCard = result; return result;
    },
  };
  return { state, tools, trace, record, idempotencyKey };
}

// Each check is executed, not asserted: the verifier must be able to fail.
function runVerifierChecks(state, complete) {
  const forecast = state.results.forecast;
  const market = state.results.market;
  const card = state.results.actionCard;
  const weeks = forecast ? [forecast.p10, forecast.p50, forecast.p90] : [];
  const orderedQuantiles = Boolean(forecast)
    && weeks.every((series) => Array.isArray(series) && series.length === forecast.weeks)
    && forecast.p10.every((low, index) => low <= forecast.p50[index] && forecast.p50[index] <= forecast.p90[index]);
  const sourceProvenance = market
    ? (market.status === "available" ? typeof market.source === "string" && Number.isFinite(market.freshness_days) : Boolean(market.reason))
    : true;
  const simulation = state.results.simulation;
  const noAutonomousAction = Boolean(card)
    && card.customer_contacted === false
    && card.account_changed === false
    && card.status === "awaiting_independent_checker"
    && card.required_next_role === "checker"
    && (!simulation || simulation.status === "counterfactual_not_causal");
  return {
    run_complete: complete,
    ordered_quantiles: orderedQuantiles,
    source_provenance: sourceProvenance,
    consent_valid: consentValid(state.consent, "financial"),
    no_autonomous_action: noAutonomousAction,
  };
}

async function runHarness(body) {
  if (killSwitchEngaged()) return { status: 503, payload: { error: "kill_switch_engaged", detail: "Operator halt is active; no new agent run is accepted." } };
  const errors = validateRequest(body);
  if (errors.length) return { status: 422, payload: { error: "contract_rejected", errors } };
  const harness = createHarness(body);
  const started = Date.now();
  const plan = await getPlan(harness.state.scenario, harness.state.consent);
  harness.trace.push(event(harness.state.runId, 1, "planner", "case_manager", "completed", { mode: plan.mode, reason: plan.reason }));
  for (const tool of plan.tools) {
    if (harness.state.toolCount >= 8 || Date.now() - started > 6000) {
      harness.record("budget_guard", "blocked", { limit: harness.state.toolCount >= 8 ? "tool_count" : "wall_time" });
      break;
    }
    harness.state.toolCount += 1;
    try { harness.record(tool, "completed", harness.tools[tool]()); }
    catch (error) { harness.record(tool, "failed", { error: error.message }); break; }
  }
  const card = harness.state.results.actionCard;
  const complete = Boolean(card && harness.state.results.forecast && harness.state.results.stress);
  const checks = runVerifierChecks(harness.state, complete);
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  const verifier = {
    passed: failed.length === 0,
    numerical_source: "deterministic_model_artifact",
    autonomy_boundary: "human_approval_required",
    checks,
    failed_checks: failed,
  };
  harness.trace.push(event(harness.state.runId, harness.trace.length + 1, "verifier", "policy_verifier", verifier.passed ? "passed" : "failed", verifier));
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ scenario: body.scenario, consent: body.consent, model: MODEL.model_id, tools: plan.tools, card })).digest("hex");
  return {
    status: verifier.passed ? 200 : 409,
    payload: {
      run_id: harness.state.runId,
      harness_version: HARNESS_VERSION,
      model_id: MODEL.model_id,
      execution_mode: plan.mode,
      plan_reason: plan.reason,
      budgets: { max_tools: 8, max_turns: 2, timeout_ms: 6000, tools_used: harness.state.toolCount },
      scenario: harness.state.scenario,
      results: harness.state.results,
      verifier,
      approval_gate: { status: "locked", maker: body.actor.id, checker: null, separation_of_duties: true },
      idempotency_key: harness.idempotencyKey,
      replay_fingerprint: fingerprint,
      trace: harness.trace,
    },
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return json(res, 200, { status: "ok", model_id: MODEL.model_id, harness: HARNESS_VERSION, kill_switch: killSwitchEngaged() ? "on" : "off" });
  if (req.method === "GET" && req.url === "/api/status") return json(res, 200, { status: killSwitchEngaged() ? "halted" : "ready", llm_adapter: Boolean(process.env.GEMINI_API_KEY), fallback: "offline_policy_runner", model_id: MODEL.model_id, kill_switch: killSwitchEngaged() ? "on" : "off" });
  if (req.method === "POST" && req.url === "/api/agent/run") {
    try {
      const body = await readBody(req);
      const result = await runHarness(body);
      return json(res, result.status, result.payload);
    } catch (error) { return json(res, error.status || 500, { error: error.message === "request_too_large" ? error.message : "request_failed" }); }
  }
  if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "method_not_allowed" }, { Allow: "GET, HEAD, POST" });
  const cleanUrl = decodeURIComponent((req.url || "/").split("?")[0]);
  const file = safeStaticPath(cleanUrl);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return json(res, 404, { error: "not_found" });
  const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };
  res.writeHead(200, headers(types[path.extname(file)] || "application/octet-stream"));
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
});

if (require.main === module) server.listen(PORT, "0.0.0.0", () => console.log(`KisanFlow listening on ${PORT}`));
module.exports = { server, runHarness, validateRequest, runVerifierChecks, REQUIRED_TOOLS };
